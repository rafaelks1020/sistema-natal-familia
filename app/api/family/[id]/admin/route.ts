import { HttpError, ok, readJson, requireAdmin, route, toInt } from '@/app/lib/api';
import { transaction } from '@/app/lib/db';

type Context = { params: Promise<{ id: string }> };
export const PUT = route<Context>(async (req, { params }) => {
  const me = await requireAdmin();
  const id = toInt((await params).id);
  const body = await readJson(req);
  if (!body || typeof body.is_admin !== 'boolean') throw new HttpError(400, 'Informe se a pessoa organiza.');
  return ok(await transaction(async (q) => {
    await q('LOCK TABLE family_users IN SHARE ROW EXCLUSIVE MODE');
    const actor = await q('SELECT id FROM family_users WHERE id = $1 AND is_admin = true', [me.id]);
    if (!actor.rowCount) throw new HttpError(403, 'Só quem organiza pode fazer isso.');
    const target = await q('SELECT id, is_admin FROM family_users WHERE id = $1', [id]);
    if (!target.rowCount) throw new HttpError(404, 'Pessoa não encontrada.');
    if (target.rows[0].is_admin && !body.is_admin) {
      const admins = await q('SELECT id FROM family_users WHERE is_admin = true');
      if (admins.rows.length <= 1) throw new HttpError(400, 'A família precisa de pelo menos um organizador.');
    }
    const { rows } = await q('UPDATE family_users SET is_admin = $1 WHERE id = $2 RETURNING id, is_admin', [body.is_admin, id]);
    return rows[0];
  }));
});
