import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { HttpError, requireAdmin, route } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { ensurePlaylist, exchange, REDIRECT_URI, save, spotify, SpotifyForbidden } from '../_service';

export const GET = route(async req => {
  const me = await requireAdmin();
  const url = new URL(req.url);
  const state = url.searchParams.get('state') || '';
  const cookie = (await cookies()).get('nf_spotify_state')?.value || '';
  if (!/^[a-f0-9]{64}$/.test(state) || !/^[a-f0-9]{64}$/.test(cookie) || !timingSafeEqual(Buffer.from(state), Buffer.from(cookie))) {
    throw new HttpError(400, 'A conexão expirou. Volte à playlist e conecte novamente.');
  }
  const key = `spotify_oauth_${createHash('sha256').update(state).digest('hex')}`;
  const used = await query(`DELETE FROM app_settings WHERE key=$1 AND value=$2
    AND updated_at > NOW() - INTERVAL '10 minutes' RETURNING key`, [key, String(me.id)]);
  if (!used.rowCount) throw new HttpError(400, 'A conexão expirou. Conecte novamente.');
  let status = 'conectada';
  try {
    const code = url.searchParams.get('code');
    if (url.searchParams.has('error') || !code) throw new HttpError(400, 'Conexão cancelada.');
    const data = await exchange(new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI }));
    if (!data.refresh_token) throw new HttpError(502, 'Autorize novamente o acesso à playlist.');
    const owner = await spotify<{ id: string }>('/me', 'GET', undefined, data.access_token);
    const old = await query<{ value: string }>(`SELECT value FROM app_settings WHERE key='spotify_owner_id'`);
    if (old.rows[0]?.value && old.rows[0].value !== owner.id) throw new HttpError(400, 'Reconecte a mesma conta Spotify usada na playlist.');
    await save({ spotify_owner_id: owner.id, spotify_refresh_token: data.refresh_token,
      spotify_access_token: data.access_token, spotify_access_expires: String(Date.now() + data.expires_in * 1000), spotify_api_bloqueada: '0',
      spotify_scope: data.scope || '' });
    await ensurePlaylist();
  } catch (error) {
    status = error instanceof SpotifyForbidden ? 'O Spotify não liberou a busca automática. Use o link da playlist e os pedidos da família.'
      : error instanceof HttpError ? error.message : 'Não foi possível conectar o Spotify. Tente novamente.';
  }
  const target = new URL('/playlist', REDIRECT_URI);
  target.searchParams.set('spotify', status);
  const res = NextResponse.redirect(target);
  res.cookies.set('nf_spotify_state', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/spotify', maxAge: 0 });
  res.headers.set('Cache-Control', 'no-store');
  return res;
});
