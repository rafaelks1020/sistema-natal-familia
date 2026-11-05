import { HttpError, ok, readJson, requireAdmin, route, toInt } from '@/app/lib/api';
import { transaction } from '@/app/lib/db';
import { discardableParticipant } from './eligibility';

export const POST = route(async (req) => {
  await requireAdmin();
  const body = await readJson(req);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Dados inválidos.');
  }
  const userId = toInt(body.user_id, 'user_id');
  const participantId = toInt(body.participant_id, 'participant_id');
  const participant = await transaction(async (q) => {
    const { rows: users } = await q<{ id: number; name: string }>(
      'SELECT id, name FROM family_users WHERE id = $1 FOR UPDATE', [userId]);
    if (!users[0]) throw new HttpError(404, 'Parente não encontrado.');
    // FOR UPDATE também impede novos vínculos por chave estrangeira durante a troca.
    const { rows: participants } = await q<{ id: number; user_id: number | null }>(`
      SELECT id, user_id FROM participants WHERE id = $1 OR user_id = $2
      ORDER BY id FOR UPDATE`, [participantId, userId]);
    const target = participants.find((p) => p.id === participantId);
    if (!target) throw new HttpError(404, 'Participante não encontrado.');
    if (target.user_id !== null) throw new HttpError(409, 'Este participante já tem um acesso vinculado.');
    const current = participants.find((p) => p.user_id === userId);
    if (!current) throw new HttpError(409, 'O parente não possui um participante atual para substituir.');
    const { rows: eligibility } = await q<{ can_discard: boolean }>(`
      SELECT ${discardableParticipant} AS can_discard FROM participants p WHERE p.id = $1`, [current.id]);
    if (!eligibility[0]?.can_discard) {
      throw new HttpError(409, 'O participante atual deste parente tem pagamentos, sorteios, desejos ou presença registrados. O vínculo não pode ser alterado sem perder esse histórico.');
    }
    await q('DELETE FROM participants WHERE id = $1', [current.id]);
    const { rows } = await q(`
      UPDATE participants SET user_id = $1, name = $2 WHERE id = $3
      RETURNING id, user_id, name`, [userId, users[0].name, participantId]);
    return rows[0];
  });
  return ok(participant);
});
