import { HttpError, ok, readJson, requireUser, route } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { hashPassword, verifyPassword } from '@/app/lib/password';

export const POST = route(async (req) => {
  const me = await requireUser();
  const body = await readJson(req);
  if (!body || typeof body.current !== 'string' || typeof body.next !== 'string' ||
      !body.current || body.current.length > 1024 || body.next.length < 6 || body.next.length > 1024) {
    throw new HttpError(400, 'Informe a senha atual e uma nova senha de 6 a 1024 caracteres.');
  }
  const { rows } = await query<{ password_hash: string }>('SELECT password_hash FROM family_users WHERE id = $1', [me.id]);
  if (!rows[0] || !verifyPassword(body.current, rows[0].password_hash)) throw new HttpError(400, 'A senha atual não confere.');
  const result = await query('UPDATE family_users SET password_hash = $1 WHERE id = $2 AND password_hash = $3',
    [hashPassword(body.next), me.id, rows[0].password_hash]);
  if (!result.rowCount) throw new HttpError(409, 'A senha mudou durante a operação. Tente novamente.');
  return ok({ ok: true });
});
