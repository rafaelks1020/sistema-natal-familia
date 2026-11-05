import { cleanText, HttpError, isBlobUrl, ok, readJson, requireUser, route } from '@/app/lib/api';
import { transaction } from '@/app/lib/db';

export const PUT = route(async (req) => {
  const me = await requireUser();
  const body = await readJson(req);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Dados inválidos.');
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of ['name', 'bio', 'avatar_url'] as const) {
    if (!(key in body)) continue;
    if (typeof body[key] !== 'string') throw new HttpError(400, `Campo ${key} inválido.`);
    const value = cleanText(body[key], key === 'name' ? 'nome' : key === 'bio' ? 'bio' : 'foto', key === 'bio' ? 160 : key === 'name' ? 120 : 2048, key === 'name');
    if (key === 'avatar_url' && value && !isBlobUrl(value)) {
      throw new HttpError(400, 'Escolha uma foto enviada pelo aplicativo.');
    }
    values.push(value || null);
    fields.push(`${key} = $${values.length}`);
  }
  if (!fields.length) throw new HttpError(400, 'Informe o que deseja atualizar.');
  const user = await transaction(async (q) => {
    const { rows } = await q(`UPDATE family_users SET ${fields.join(', ')} WHERE id = $${values.length + 1}
      RETURNING id, name, username, avatar_url, bio, is_admin`, [...values, me.id]);
    if (!rows[0]) throw new HttpError(404, 'Pessoa não encontrada.');
    if ('name' in body) await q('UPDATE participants SET name = $1 WHERE user_id = $2', [rows[0].name, me.id]);
    return rows[0];
  });
  return ok({ ...user, participant_id: me.participant_id });
});
