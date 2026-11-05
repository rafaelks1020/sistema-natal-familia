import 'server-only';
import { HttpError } from '@/app/lib/api';
import { query, transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { parsePedido, parseSpotifyLink } from './link';
import type { SessionUser } from '@/app/lib/session';

export const REDIRECT_URI = 'https://natalemfamilia.com.br/api/spotify/callback';
export const SCOPES = 'playlist-modify-private playlist-modify-public playlist-read-private';
export const configured = () => Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
export type SpotifyTrack = { uri: string; name: string; artists: { name: string }[]; album: { images: { url: string }[] } };
export type Track = { id: number; user_id: number; track_uri: string; nome: string; artista: string; capa_url: string | null; autor: string; created_at: string };

/** 403 da Web API: normalmente app em modo desenvolvimento cuja conta dona não é Premium. */
export class SpotifyForbidden extends HttpError {}

function friendly(status: number): HttpError {
  if (status === 403) return new SpotifyForbidden(503, 'Peça a quem organiza para reconectar o Spotify e conferir o acesso da conta.');
  if (status === 429) return new HttpError(429, 'O Spotify está recebendo muitos pedidos. Aguarde um pouco e tente novamente.');
  if (status === 401) return new HttpError(503, 'Peça a quem organiza para reconectar o Spotify e conferir o acesso da conta.');
  return new HttpError(502, 'Não conseguimos conversar com o Spotify agora. Tente novamente em instantes.');
}

async function safeFetch(url: string, init: RequestInit): Promise<Response> {
  try { return await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(10000) }); }
  catch { throw friendly(502); }
}

export async function exchange(params: URLSearchParams) {
  if (!configured()) throw new HttpError(503, 'Playlist ainda não conectada.');
  const response = await safeFetch('https://accounts.spotify.com/api/token', {
    method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded' }, body: params,
  });
  if (!response.ok) throw friendly(response.status);
  const data = await response.json() as { access_token: string; refresh_token?: string; expires_in: number };
  if (!data.access_token) throw friendly(502);
  return data;
}

export async function settings(q = query) {
  const { rows } = await q<{ key: string; value: string }>(
    `SELECT key, value FROM app_settings WHERE key = ANY($1::text[])`,
    [['spotify_refresh_token', 'spotify_playlist_id', 'spotify_playlist_ano', 'spotify_access_token', 'spotify_access_expires', 'spotify_playlist_link', 'spotify_api_bloqueada']]);
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

export async function save(values: Record<string, string>, q = query) {
  await q(`INSERT INTO app_settings(key, value, updated_at)
    SELECT key, value, NOW() FROM jsonb_each_text($1::jsonb)
    ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`, [JSON.stringify(values)]);
}

async function token() {
  return transaction(async q => {
    await q('SELECT pg_advisory_xact_lock($1)', [16001]);
    const s = await settings(q);
    if (!configured() || !s.spotify_refresh_token) throw new HttpError(503, 'Playlist ainda não conectada.');
    if (s.spotify_access_token && Number(s.spotify_access_expires) > Date.now() + 60000) return s.spotify_access_token;
    const data = await exchange(new URLSearchParams({ grant_type: 'refresh_token', refresh_token: s.spotify_refresh_token }));
    await save({ spotify_access_token: data.access_token, spotify_access_expires: String(Date.now() + data.expires_in * 1000),
      ...(data.refresh_token ? { spotify_refresh_token: data.refresh_token } : {}) }, q);
    return data.access_token;
  });
}

export async function spotify<T>(path: string, method = 'GET', body?: object, access?: string): Promise<T> {
  const response = await safeFetch(`https://api.spotify.com/v1${path}`, {
    method, headers: { Authorization: `Bearer ${access || await token()}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    if (response.status === 401) await query(`DELETE FROM app_settings WHERE key = 'spotify_access_expires'`);
    throw friendly(response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function ensurePlaylist() {
  const access = await token();
  return transaction(async q => {
    await q('SELECT pg_advisory_xact_lock($1)', [16002]);
    const s = await settings(q);
    const ano = edicaoAtual();
    if (s.spotify_playlist_id && Number(s.spotify_playlist_ano) === ano) return s.spotify_playlist_id;
    const me = await spotify<{ id: string }>('/me', 'GET', undefined, access);
    let found: string | undefined;
    for (let offset = 0; ; offset += 50) {
      const list = await spotify<{ items: { id: string; name: string; owner: { id: string } }[]; next: string | null }>(`/me/playlists?limit=50&offset=${offset}`, 'GET', undefined, access);
      found = list.items.find(p => p.name === `Natal em Família ${ano}` && p.owner.id === me.id)?.id;
      if (found || !list.next) break;
    }
    if (!found) found = (await spotify<{ id: string }>('/me/playlists', 'POST', { name: `Natal em Família ${ano}`, public: false,
      description: 'As músicas escolhidas pela nossa família para a ceia.' }, access)).id;
    if (!found || !/^[a-zA-Z0-9]+$/.test(found)) throw friendly(502);
    await save({ spotify_playlist_id: found, spotify_playlist_ano: String(ano) }, q);
    return found;
  });
}

const BLOQUEIO_MS = 6 * 60 * 60 * 1000;
const PEDIDO = 'pedido:';

/** Conexão OAuth feita e uma chamada de teste à Web API que não deu 403. Qualquer falha esconde a busca, sem erro na tela. */
async function apiDisponivel(s: Record<string, string>): Promise<{ api: boolean; playlistId: string | null }> {
  if (!configured() || !s.spotify_refresh_token) return { api: false, playlistId: null };
  if (Date.now() - Number(s.spotify_api_bloqueada || 0) < BLOQUEIO_MS) return { api: false, playlistId: null };
  try {
    await spotify('/me');
    return { api: true, playlistId: await ensurePlaylist() };
  } catch (error) {
    if (error instanceof SpotifyForbidden) await save({ spotify_api_bloqueada: String(Date.now()) }).catch(() => undefined);
    return { api: false, playlistId: null };
  }
}

export async function playlistData(me: SessionUser) {
  const s = await settings();
  const connected = configured() && Boolean(s.spotify_refresh_token);
  const { api, playlistId } = await apiDisponivel(s);
  const manual = s.spotify_playlist_link ? parseSpotifyLink(s.spotify_playlist_link) : null;
  const ano = edicaoAtual();
  const [tracks, count] = await Promise.all([
    query<Track>(`SELECT t.*, u.name AS autor FROM playlist_tracks t JOIN family_users u ON u.id=t.user_id
      WHERE t.ano=$1 AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id=$2 AND b.blocked_id=t.user_id)
      ORDER BY t.created_at DESC, t.id DESC`, [ano, me.id]),
    query<{ total: number }>('SELECT COUNT(*)::int AS total FROM playlist_tracks WHERE ano=$1 AND user_id=$2', [ano, me.id]),
  ]);
  const playlistUrl = playlistId ? `https://open.spotify.com/playlist/${playlistId}` : null;
  return { ano, connected, api, configured: configured(), playlist_url: playlistUrl,
    link: manual?.link || playlistUrl, embed_id: manual?.id || playlistId,
    tracks: tracks.rows.filter(t => !t.track_uri.startsWith(PEDIDO)),
    pedidos: tracks.rows.filter(t => t.track_uri.startsWith(PEDIDO)),
    minhas: count.rows[0].total, limite: 15 };
}

export async function salvarLink(raw: unknown) {
  if (typeof raw === 'string' && !raw.trim()) {
    await query(`DELETE FROM app_settings WHERE key = 'spotify_playlist_link'`);
    return { ok: true, link: null, embed_id: null };
  }
  const parsed = parseSpotifyLink(raw);
  if (!parsed) throw new HttpError(400, 'Cole o link de uma playlist do Spotify (open.spotify.com/playlist/...).');
  await save({ spotify_playlist_link: parsed.link });
  return { ok: true, link: parsed.link, embed_id: parsed.id };
}

export async function criarPedido(me: SessionUser, texto: unknown) {
  const pedido = parsePedido(texto);
  if (!pedido) throw new HttpError(400, 'Escreva a música e o artista (até 120 caracteres).');
  const ano = edicaoAtual();
  return transaction(async q => {
    await q('SELECT pg_advisory_xact_lock($1, $2)', [16003, ano]);
    const existing = await q('SELECT 1 FROM playlist_tracks WHERE ano=$1 AND track_uri=$2', [ano, pedido.chave]);
    if (existing.rows.length) throw new HttpError(409, 'Já pediram essa.');
    const count = await q<{ total: number }>('SELECT COUNT(*)::int AS total FROM playlist_tracks WHERE ano=$1 AND user_id=$2', [ano, me.id]);
    if (count.rows[0].total >= 15) throw new HttpError(400, 'Você já escolheu 15 músicas nesta edição. Remova uma para escolher outra.');
    await q(`INSERT INTO playlist_tracks(ano,user_id,track_uri,nome,artista,capa_url) VALUES ($1,$2,$3,$4,$5,NULL)`,
      [ano, me.id, pedido.chave, pedido.nome, pedido.artista]);
    return { ok: true };
  });
}

export async function apagarPedido(me: SessionUser, id: number) {
  return transaction(async q => {
    const { rows } = await q<{ user_id: number }>(`SELECT user_id FROM playlist_tracks WHERE id=$1 AND ano=$2 AND track_uri LIKE 'pedido:%' FOR UPDATE`, [id, edicaoAtual()]);
    if (!rows[0]) throw new HttpError(404, 'Este pedido já foi removido.');
    if (rows[0].user_id !== me.id && !me.is_admin) throw new HttpError(403, 'Só quem pediu ou quem organiza pode remover.');
    await q('DELETE FROM playlist_tracks WHERE id=$1', [id]);
    return { ok: true };
  });
}

export async function containsTrack(playlistId: string, uri: string, access: string) {
  for (let offset = 0; ; offset += 50) {
    const page = await spotify<{ items: { item?: { uri: string }; track?: { uri: string } }[]; next: string | null }>(
      `/playlists/${playlistId}/items?limit=50&offset=${offset}`, 'GET', undefined, access);
    if (page.items.some(t => (t.item || t.track)?.uri === uri)) return true;
    if (!page.next) return false;
  }
}

export async function mutatePlaylist(me: SessionUser, uri: string, remove: boolean) {
  if (!/^spotify:track:[a-zA-Z0-9]{22}$/.test(uri)) throw new HttpError(400, 'Escolha uma música válida na busca.');
  const playlistId = await ensurePlaylist();
  const access = await token();
  return transaction(async q => {
    await q('SELECT pg_advisory_xact_lock($1, $2)', [16003, edicaoAtual()]);
    const existing = await q<Track>('SELECT * FROM playlist_tracks WHERE ano=$1 AND track_uri=$2', [edicaoAtual(), uri]);
    const track = existing.rows[0];
    if (remove) {
      if (!track) throw new HttpError(404, 'Esta música já foi removida.');
      if (track.user_id !== me.id && !me.is_admin) throw new HttpError(403, 'Só quem adicionou ou quem organiza pode remover.');
      await spotify(`/playlists/${playlistId}/items`, 'DELETE', { items: [{ uri }] }, access);
      await q('DELETE FROM playlist_tracks WHERE id=$1', [track.id]);
    } else {
      if (track) throw new HttpError(409, 'Essa música já está na playlist.');
      const count = await q<{ total: number }>('SELECT COUNT(*)::int AS total FROM playlist_tracks WHERE ano=$1 AND user_id=$2', [edicaoAtual(), me.id]);
      if (count.rows[0].total >= 15) throw new HttpError(400, 'Você já escolheu 15 músicas nesta edição. Remova uma para escolher outra.');
      const song = await spotify<SpotifyTrack>(`/tracks/${uri.split(':')[2]}`, 'GET', undefined, access);
      // Após uma resposta perdida, uma nova tentativa aproveita a música já enviada ao Spotify.
      if (!await containsTrack(playlistId, uri, access)) await spotify(`/playlists/${playlistId}/items`, 'POST', { uris: [uri] }, access);
      await q(`INSERT INTO playlist_tracks(ano,user_id,track_uri,nome,artista,capa_url) VALUES ($1,$2,$3,$4,$5,$6)`,
        [edicaoAtual(), me.id, uri, song.name, song.artists.map(a => a.name).join(', '), song.album.images[0]?.url || null]);
    }
    return { ok: true };
  });
}
