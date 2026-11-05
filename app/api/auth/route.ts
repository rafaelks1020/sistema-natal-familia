import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { transaction, query } from '@/app/lib/db';
import { HttpError, cleanText, ok, readJson, route } from '@/app/lib/api';
import { hashPassword, verifyPassword } from '@/app/lib/password';
import { clearSessionCookie, getSessionUser, setSessionCookie } from '@/app/lib/session';

// GET    /api/auth            -> usuário logado ou { user: null }
// POST   /api/auth            -> { action: 'login' | 'register', username, password, name?, code? }
// DELETE /api/auth            -> sair

function normalizarUsuario(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^[.]+|[.]+$/g, '')
    .slice(0, 40);
}

function sameText(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const GET = route(async () => {
  return ok({ user: await getSessionUser() });
});

export const POST = route(async (req) => {
  const body = await readJson<Record<string, unknown>>(req);
  const action = body.action;
  // Tolerante ao celular: sem acento, minúsculo, espaço vira ponto, resto inválido sai.
  const username = normalizarUsuario(cleanText(body.username, 'o usuário', 60));
  const password = typeof body.password === 'string' ? body.password : '';

  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    throw new HttpError(400, 'O usuário precisa ter pelo menos 3 letras ou números.');
  }

  if (action === 'login') {
    const { rows } = await query(
      'SELECT id, password_hash FROM family_users WHERE username = $1',
      [username],
    );
    const user = rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new HttpError(401, 'Usuário ou senha não conferem.');
    }
    const res = NextResponse.json({ ok: true });
    setSessionCookie(res, user.id);
    return res;
  }

  if (action === 'register') {
    const familyCode = process.env.FAMILY_CODE;
    if (!familyCode) throw new HttpError(503, 'Cadastro fechado: falta configurar o código da família.');
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    // Ignora maiúsculas, espaços e ponto final (a família digita no celular).
    const norm = (s: string) => s.trim().toLowerCase().replace(/[.\s]+$/, '');
    if (!sameText(norm(code), norm(familyCode))) {
      throw new HttpError(403, 'Código da família incorreto. Peça para quem organiza.');
    }
    const name = cleanText(body.name, 'seu nome', 60);
    if (password.length < 6) throw new HttpError(400, 'A senha precisa ter pelo menos 6 caracteres.');

    const userId = await transaction(async (q) => {
      const exists = await q('SELECT 1 FROM family_users WHERE username = $1', [username]);
      if (exists.rows.length) throw new HttpError(409, 'Esse usuário já existe. Escolha outro.');

      // O primeiro cadastro da família vira quem organiza.
      const admins = await q('SELECT 1 FROM family_users WHERE is_admin LIMIT 1');
      const isAdmin = admins.rows.length === 0;

      const created = await q<{ id: number }>(
        `INSERT INTO family_users (name, username, password_hash, is_admin)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [name, username, hashPassword(password), isAdmin],
      );
      const id = created.rows[0].id;

      // Liga a um participante sem login com o mesmo nome (cadastrado pelo organizador)
      // ou cria um novo.
      const linked = await q(
        `UPDATE participants SET user_id = $1
          WHERE id = (SELECT id FROM participants
                       WHERE user_id IS NULL AND lower(name) = lower($2)
                       ORDER BY id LIMIT 1)
          RETURNING id`,
        [id, name],
      );
      if (!linked.rows.length) {
        await q('INSERT INTO participants (name, user_id) VALUES ($1, $2)', [name, id]);
      }
      return id;
    });

    const res = NextResponse.json({ ok: true }, { status: 201 });
    setSessionCookie(res, userId);
    return res;
  }

  throw new HttpError(400, 'Ação inválida.');
});

export const DELETE = route(async () => {
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
});
