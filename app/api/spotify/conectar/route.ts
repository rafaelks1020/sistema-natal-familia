import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { HttpError, requireAdmin, route } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { configured, REDIRECT_URI, SCOPES } from '../_service';

export const GET = route(async () => {
  const me = await requireAdmin();
  if (!configured()) throw new HttpError(503, 'Playlist ainda não conectada. Configure SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no servidor.');
  const state = randomBytes(32).toString('hex');
  const key = `spotify_oauth_${createHash('sha256').update(state).digest('hex')}`;
  await query(`DELETE FROM app_settings WHERE key LIKE 'spotify_oauth_%' AND updated_at < NOW() - INTERVAL '15 minutes'`);
  await query('INSERT INTO app_settings(key,value,updated_at) VALUES ($1,$2,NOW())', [key, String(me.id)]);
  const url = new URL('https://accounts.spotify.com/authorize');
  url.search = new URLSearchParams({ response_type: 'code', client_id: process.env.SPOTIFY_CLIENT_ID!,
    scope: SCOPES, redirect_uri: REDIRECT_URI, state }).toString();
  const res = NextResponse.redirect(url);
  res.cookies.set('nf_spotify_state', state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/spotify', maxAge: 600 });
  res.headers.set('Cache-Control', 'no-store');
  return res;
});
