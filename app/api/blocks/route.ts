import { query } from '@/app/lib/db';
import { HttpError, ok, readJson, requireUser, route, toInt } from '@/app/lib/api';

export const GET = route(async () => {
  const me = await requireUser();
  const { rows } = await query(`SELECT u.id, u.name, u.avatar_url, b.created_at
    FROM user_blocks b JOIN family_users u ON u.id = b.blocked_id
    WHERE b.blocker_id = $1 ORDER BY u.name, u.id`, [me.id]);
  return ok(rows);
});
export const POST = route(async (req) => {
  const me = await requireUser();
  const body = await readJson<Record<string, unknown>>(req);
  const id = toInt(body.user_id, 'user_id');
  if (id === me.id) throw new HttpError(400, 'Você não pode bloquear a si mesmo.');
  const { rows } = await query(`INSERT INTO user_blocks (blocker_id, blocked_id)
    SELECT $1, id FROM family_users WHERE id = $2
    ON CONFLICT DO NOTHING RETURNING blocked_id`, [me.id, id]);
  if (!rows.length) {
    const exists = await query('SELECT id FROM family_users WHERE id = $1', [id]);
    if (!exists.rows.length) throw new HttpError(404, 'Pessoa não encontrada.');
  }
  return ok({ ok: true });
});
