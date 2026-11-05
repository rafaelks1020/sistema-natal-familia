import { query } from '@/app/lib/db';
import { HttpError, cleanText, ok, readJson, requireAdmin, route, toInt } from '@/app/lib/api';
import { carregarConvites, novoToken } from '@/app/lib/convites';

// GET  /api/invites  (organizador) -> convites com situação e quem entrou por cada um
// POST /api/invites  (organizador) { label, participant_id?, max_uses?, days? } -> convite criado

export const GET = route(async () => {
  await requireAdmin();
  return ok(await carregarConvites());
});

export const POST = route(async (req) => {
  const me = await requireAdmin();
  const body = await readJson<Record<string, unknown>>(req);
  const label = cleanText(body.label, 'para quem é o convite', 60);

  let participantId: number | null = null;
  if (body.participant_id !== undefined && body.participant_id !== null && body.participant_id !== '') {
    participantId = toInt(body.participant_id, 'participante');
    const { rows } = await query('SELECT user_id FROM participants WHERE id = $1', [participantId]);
    if (!rows[0]) throw new HttpError(404, 'Participante não encontrado.');
    if (rows[0].user_id) throw new HttpError(409, 'Esse participante já tem acesso.');
  }

  // Convite de uma pessoa vale 1 uso; convite geral vale para quantos precisar (ou o limite dado).
  let maxUses: number | null = participantId ? 1 : null;
  if (!participantId && body.max_uses !== undefined && body.max_uses !== null && body.max_uses !== '') {
    maxUses = toInt(body.max_uses, 'limite de usos');
    if (maxUses > 200) throw new HttpError(400, 'Limite de usos muito alto.');
  }
  const days = body.days === undefined || body.days === null || body.days === '' ? 30 : toInt(body.days, 'validade');
  if (days > 120) throw new HttpError(400, 'Validade máxima de 120 dias.');

  const { rows } = await query(
    `INSERT INTO invites (token, label, participant_id, max_uses, expires_at, created_by)
     VALUES ($1, $2, $3, $4, NOW() + make_interval(days => $5), $6)
     RETURNING id, token, label, participant_id, max_uses, uses`,
    [novoToken(), label, participantId, maxUses, days, me.id],
  );
  return ok(rows[0], 201);
});
