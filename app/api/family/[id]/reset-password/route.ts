import { randomInt } from 'crypto';
import { HttpError, ok, requireAdmin, route, toInt } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { hashPassword } from '@/app/lib/password';

type Context = { params: Promise<{ id: string }> };
export const POST = route<Context>(async (_req, { params }) => {
  const me = await requireAdmin();
  const id = toInt((await params).id);
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const password = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join('');
  const result = await query(`UPDATE family_users SET password_hash = $1, session_version = session_version + 1 WHERE id = $2
    AND EXISTS (SELECT 1 FROM family_users WHERE id = $3 AND is_admin = true) RETURNING id`, [await hashPassword(password), id, me.id]);
  if (!result.rowCount) throw new HttpError(404, 'Pessoa não encontrada ou acesso de organizador removido.');
  const response = ok({ password });
  response.headers.set('Cache-Control', 'no-store');
  return response;
});
