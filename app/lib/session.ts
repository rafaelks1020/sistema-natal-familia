import { cache } from 'react';
import { createHmac, timingSafeEqual } from 'crypto';
import { cookies, headers } from 'next/headers';
import { after, NextResponse } from 'next/server';
import { query } from './db';
import { hojeSP } from './edicao';

// Sessão assinada (HMAC-SHA256) num cookie httpOnly. O servidor é a única fonte de verdade
// sobre quem é o usuário: nenhuma rota confia em user_id vindo do corpo da requisição.

export const SESSION_COOKIE = 'nf_sessao';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 60; // 60 dias: a família entra uma vez e fica logada

export interface SessionUser {
  id: number;
  name: string;
  username: string;
  is_admin: boolean;
  avatar_url: string | null;
  participant_id: number | null;
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET ausente ou curto (mínimo 32 caracteres)');
  }
  return s;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createSessionToken(userId: number, sessionVersion: number): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, v: sessionVersion, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS }),
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function readSessionToken(token: string | undefined): { uid: number; v: number } | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data.uid !== 'number' || typeof data.exp !== 'number') return null;
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    const v = data.v === undefined ? 1 : data.v;
    if (!Number.isInteger(v) || v < 1) return null;
    return { uid: data.uid, v };
  } catch {
    return null;
  }
}

export function setSessionCookie(res: NextResponse, userId: number, sessionVersion: number): void {
  res.cookies.set(SESSION_COOKIE, createSessionToken(userId, sessionVersion), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

// Uma tentativa por pessoa por dia, por instância. O INSERT só grava se o dia ainda não existe.
const vistosHoje = new Map<number, string>();
const visitaEmCurso = new Set<number>();
let visitasOffAte = 0;

function registrarVisita(userId: number): void {
  if (Date.now() < visitasOffAte) return;
  const dia = hojeSP();
  if (vistosHoje.get(userId) === dia || visitaEmCurso.has(userId)) return;
  visitaEmCurso.add(userId);
  const gravar = async () => {
    try {
      await query(
        `WITH nova AS (
           INSERT INTO family_daily_visits (user_id, dia, primeira, ultima)
           VALUES ($1, $2::date, NOW(), NOW())
           ON CONFLICT (user_id, dia) DO NOTHING
           RETURNING user_id
         )
         UPDATE family_users SET last_seen_at = NOW()
          WHERE id IN (SELECT user_id FROM nova)`,
        [userId, dia],
      );
      vistosHoje.set(userId, dia);
      if (vistosHoje.size > 300) {
        for (const [id, d] of vistosHoje) if (d !== dia) vistosHoje.delete(id);
      }
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === '42P01' || code === '42703') visitasOffAte = Date.now() + 60 * 60 * 1000;
      else console.error('[sessao] visita:', err instanceof Error ? err.message : 'falha');
    } finally {
      visitaEmCurso.delete(userId);
    }
  };
  try {
    after(gravar);
  } catch {
    void gravar();
  }
}

/**
 * Usuário logado (uma leitura do banco por renderização, para is_admin valer na hora) ou null.
 * Site: cookie httpOnly. App nativo: "Authorization: Bearer <token>" (mesmo token assinado).
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const auth = (await headers()).get('authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : undefined;
  const session = readSessionToken(bearer || store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const { rows } = await query<SessionUser>(
    `SELECT u.id, u.name, u.username, u.is_admin, u.avatar_url, p.id AS participant_id
       FROM family_users u
       LEFT JOIN participants p ON p.user_id = u.id
      WHERE u.id = $1 AND u.session_version = $2`,
    [session.uid, session.v],
  );
  const user = rows[0];
  if (!user) return null;
  registrarVisita(user.id);
  return user;
});
