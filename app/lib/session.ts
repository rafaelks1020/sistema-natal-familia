import { createHmac, timingSafeEqual } from 'crypto';
import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { query } from './db';

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

export function createSessionToken(userId: number): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS }),
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function readSessionToken(token: string | undefined): number | null {
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
    return data.uid;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: NextResponse, userId: number): void {
  res.cookies.set(SESSION_COOKIE, createSessionToken(userId), {
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

/**
 * Usuário logado (lido do banco a cada chamada, para is_admin valer na hora) ou null.
 * Site: cookie httpOnly. App nativo: "Authorization: Bearer <token>" (mesmo token assinado).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const auth = (await headers()).get('authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : undefined;
  const uid = readSessionToken(bearer || store.get(SESSION_COOKIE)?.value);
  if (!uid) return null;
  const { rows } = await query<SessionUser>(
    `SELECT u.id, u.name, u.username, u.is_admin, u.avatar_url, p.id AS participant_id
       FROM family_users u
       LEFT JOIN participants p ON p.user_id = u.id
      WHERE u.id = $1`,
    [uid],
  );
  return rows[0] ?? null;
}
