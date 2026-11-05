import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { transaction, query } from '@/app/lib/db';
import { HttpError, cleanText, ok, readJson, route } from '@/app/lib/api';
import { hashPassword, verifyPassword } from '@/app/lib/password';
import { motivoInvalido, SQL_VENCIDO } from '@/app/lib/convites';
import { clearSessionCookie, createSessionToken, getSessionUser, setSessionCookie } from '@/app/lib/session';

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

// Limite de tentativas erradas em 15 min: por IP (30) e por usuário (8). Só falha conta.
const JANELA = "15 minutes";
async function bloqueado(ip: string, usuario: string): Promise<boolean> {
  const { rows } = await query<{ ip: number; usr: number }>(
    `SELECT count(*) FILTER (WHERE chave = $1)::int AS ip, count(*) FILTER (WHERE chave = $2)::int AS usr
       FROM auth_attempts WHERE chave IN ($1, $2) AND criado_em > NOW() - $3::interval`,
    [`ip:${ip}`, `user:${usuario}`, JANELA],
  );
  return (rows[0]?.ip ?? 0) >= 30 || (rows[0]?.usr ?? 0) >= 8;
}
async function registrarFalha(ip: string, usuario: string): Promise<void> {
  await query(`INSERT INTO auth_attempts (chave) VALUES ($1), ($2)`, [`ip:${ip}`, `user:${usuario}`]);
  if (Math.random() < 0.05) await query(`DELETE FROM auth_attempts WHERE criado_em < NOW() - INTERVAL '1 day'`);
}
function ipDe(req: Request): string {
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'desconhecido';
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

  const ip = ipDe(req);
  if (await bloqueado(ip, username)) {
    throw new HttpError(429, 'Muitas tentativas erradas. Espere 15 minutos e tente de novo.');
  }

  if (action === 'login') {
    const { rows } = await query(
      'SELECT id, password_hash, session_version FROM family_users WHERE username = $1',
      [username],
    );
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      await registrarFalha(ip, username);
      throw new HttpError(401, 'Usuário ou senha não conferem.');
    }
    const res = NextResponse.json(body.client === 'app' ? { ok: true, token: createSessionToken(user.id, user.session_version) } : { ok: true });
    setSessionCookie(res, user.id, user.session_version);
    return res;
  }

  if (action === 'register') {
    // Entra por convite (link do organizador) OU pelo código da família.
    const inviteToken = typeof body.invite === 'string' ? body.invite.trim() : '';
    if (!inviteToken) {
      const familyCode = process.env.FAMILY_CODE;
      if (!familyCode) throw new HttpError(503, 'Cadastro fechado: peça um link de convite para quem organiza.');
      const code = typeof body.code === 'string' ? body.code.trim() : '';
      // Só letras e números contam: maiúscula, espaço, ponto e acento do teclado do celular não atrapalham.
      const norm = (s: string) => s.normalize('NFD').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (!sameText(norm(code), norm(familyCode))) {
        await registrarFalha(ip, username);
        throw new HttpError(403, 'Código da família incorreto. Peça para quem organiza.');
      }
    }
    const name = cleanText(body.name, 'seu nome', 60);
    if (password.length < 6) throw new HttpError(400, 'A senha precisa ter pelo menos 6 caracteres.');

    const userId = await transaction(async (q) => {
      // Trava: dois cadastros ao mesmo tempo não viram os dois "primeiro organizador".
      await q('SELECT pg_advisory_xact_lock(7213)');
      const exists = await q('SELECT 1 FROM family_users WHERE username = $1', [username]);
      if (exists.rows.length) throw new HttpError(409, 'Esse usuário já existe. Escolha outro.');

      // O primeiro cadastro da família vira quem organiza.
      const admins = await q('SELECT 1 FROM family_users WHERE is_admin LIMIT 1');
      const isAdmin = admins.rows.length === 0;

      // Convite: trava a linha, confere e consome um uso na mesma transação.
      let invite: { id: number; participant_id: number | null } | null = null;
      if (inviteToken) {
        const { rows } = await q(
          `SELECT id, participant_id, max_uses, uses, revoked_at, ${SQL_VENCIDO}
             FROM invites WHERE token = $1 FOR UPDATE`,
          [inviteToken],
        );
        const c = rows[0];
        const motivo = c ? motivoInvalido(c) : 'Convite inválido.';
        if (motivo) {
          await registrarFalha(ip, username);
          throw new HttpError(403, `${motivo} Peça um novo para quem organiza.`);
        }
        await q('UPDATE invites SET uses = uses + 1 WHERE id = $1', [c.id]);
        invite = { id: c.id, participant_id: c.participant_id };
      }

      const created = await q<{ id: number }>(
        `INSERT INTO family_users (name, username, password_hash, is_admin, invite_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [name, username, await hashPassword(password), isAdmin, invite?.id ?? null],
      );
      const id = created.rows[0].id;

      // Convite feito para um participante (ex.: a avó que já está na vaquinha): o cadastro
      // assume esse participante. Seguro porque foi o organizador que escolheu.
      if (invite?.participant_id) {
        const linked = await q(
          'UPDATE participants SET user_id = $1, name = $2 WHERE id = $3 AND user_id IS NULL RETURNING id',
          [id, name, invite.participant_id],
        );
        if (linked.rows.length) return id;
      }

      // Sempre um participante novo. Ligar a um participante já cadastrado pelo organizador
      // (ex.: quem estava no sorteio sem login) é ação do organizador em /organizar:
      // ligar pelo nome deixaria qualquer um assumir outra pessoa e ver o amigo oculto dela.
      await q('INSERT INTO participants (name, user_id) VALUES ($1, $2)', [name, id]);
      return id;
    });

    const res = NextResponse.json(
      body.client === 'app' ? { ok: true, token: createSessionToken(userId, 1) } : { ok: true },
      { status: 201 },
    );
    setSessionCookie(res, userId, 1);
    return res;
  }

  throw new HttpError(400, 'Ação inválida.');
});

export const DELETE = route(async (req) => {
  const text = await req.text();
  let body: unknown;
  if (text.trim()) {
    try { body = JSON.parse(text); }
    catch { throw new HttpError(400, 'Dados inválidos.'); }
  }
  const token = body && typeof body === 'object' && 'push_token' in body ? body.push_token : null;
  const me = await getSessionUser();
  if (me && typeof token === 'string' && token) {
    await query('DELETE FROM push_devices WHERE user_id = $1 AND token = $2', [me.id, token]);
  }
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
});
