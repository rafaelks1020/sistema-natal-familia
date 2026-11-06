import 'server-only';
import { HttpError } from '@/app/lib/api';
import { query, transaction } from '@/app/lib/db';
import { edicaoAtual, hojeSP } from '@/app/lib/edicao';
import { parsePedido, parseSpotifyLink } from './link';
import { LIMITE_POR_MOMENTO, MOMENTO_IDS, MOMENTOS, nomePlaylist, type Momento } from './momentos';
import type { SessionUser } from '@/app/lib/session';

export const REDIRECT_URI = 'https://natalemfamilia.com.br/api/spotify/callback';
export const SCOPES = 'playlist-modify-private playlist-modify-public playlist-read-private user-read-currently-playing'
  + ' streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state';
export const configured = () => Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
export type SpotifyTrack = { uri: string; name: string; artists: { name: string }[]; album: { images: { url: string }[] } };
export type Track = { id: number; user_id: number; track_uri: string; nome: string; artista: string; capa_url: string | null; autor: string; created_at: string;
  momento: Momento; votos: number; votei: boolean };

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
  const data = await response.json() as { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
  if (!data.access_token) throw friendly(502);
  return data;
}

export async function settings(q = query) {
  const { rows } = await q<{ key: string; value: string }>(
    `SELECT key, value FROM app_settings WHERE key = ANY($1::text[]) OR key LIKE 'spotify_playlist_%' OR key LIKE 'spotify_reorder_%'`,
    [['spotify_refresh_token', 'spotify_access_token', 'spotify_access_expires', 'spotify_api_bloqueada', 'spotify_scope']]);
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
      ...(data.refresh_token ? { spotify_refresh_token: data.refresh_token } : {}), ...(data.scope ? { spotify_scope: data.scope } : {}) }, q);
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

/** Id da playlist do momento já guardado (a da festa é a antiga, guardada nas chaves sem momento). Não cria nada. */
function playlistGuardada(s: Record<string, string>, momento: Momento, ano: number): string | null {
  const id = s[`spotify_playlist_${ano}_${momento}`]
    || (momento === 'festa' && Number(s.spotify_playlist_ano) === ano ? s.spotify_playlist_id : '');
  return id && /^[a-zA-Z0-9]+$/.test(id) ? id : null;
}

/** Devolve a playlist do momento e cria (com o token do organizador) na primeira vez que alguém abre aquele momento. */
export async function ensurePlaylist(momento: Momento = 'festa') {
  const access = await token();
  return transaction(async q => {
    await q('SELECT pg_advisory_xact_lock($1)', [16002]);
    const s = await settings(q);
    const ano = edicaoAtual();
    const chave = `spotify_playlist_${ano}_${momento}`;
    const guardada = playlistGuardada(s, momento, ano);
    if (guardada) {
      if (!s[chave]) await save({ [chave]: guardada }, q);
      return guardada;
    }
    const nome = nomePlaylist(momento, ano);
    const me = await spotify<{ id: string }>('/me', 'GET', undefined, access);
    let found: string | undefined;
    for (let offset = 0; ; offset += 50) {
      const list = await spotify<{ items: { id: string; name: string; owner: { id: string } }[]; next: string | null }>(`/me/playlists?limit=50&offset=${offset}`, 'GET', undefined, access);
      found = list.items.find(p => p.name === nome && p.owner.id === me.id)?.id;
      if (found || !list.next) break;
    }
    if (!found) found = (await spotify<{ id: string }>('/me/playlists', 'POST', { name: nome, public: false,
      description: MOMENTOS[momento].detalhe }, access)).id;
    if (!found || !/^[a-zA-Z0-9]+$/.test(found)) throw friendly(502);
    await save({ [chave]: found, ...(momento === 'festa' ? { spotify_playlist_id: found, spotify_playlist_ano: String(ano) } : {}) }, q);
    return found;
  });
}

const BLOQUEIO_MS = 6 * 60 * 60 * 1000;
const PEDIDO = 'pedido:';

/** Conexão OAuth feita e uma chamada de teste à Web API que não deu 403. Qualquer falha esconde a busca, sem erro na tela. */
async function apiDisponivel(s: Record<string, string>, momento: Momento): Promise<{ api: boolean; playlistId: string | null }> {
  if (!configured() || !s.spotify_refresh_token) return { api: false, playlistId: null };
  if (Date.now() - Number(s.spotify_api_bloqueada || 0) < BLOQUEIO_MS) return { api: false, playlistId: null };
  try {
    await spotify('/me');
    return { api: true, playlistId: await ensurePlaylist(momento) };
  } catch (error) {
    if (error instanceof SpotifyForbidden) await save({ spotify_api_bloqueada: String(Date.now()) }).catch(() => undefined);
    return { api: false, playlistId: null };
  }
}

const ORDEM_VOTOS = 'votos DESC, t.created_at ASC, t.id ASC';
const VOTOS_SQL = `(SELECT COUNT(*)::int FROM playlist_track_votes v WHERE v.track_id=t.id) AS votos`;

export async function playlistData(me: SessionUser, momento: Momento = 'festa') {
  const s = await settings();
  const connected = configured() && Boolean(s.spotify_refresh_token);
  const { api, playlistId } = await apiDisponivel(s, momento);
  // O link colado à mão é da playlist da festa, a original.
  const manual = momento === 'festa' && s.spotify_playlist_link ? parseSpotifyLink(s.spotify_playlist_link) : null;
  const ano = edicaoAtual();
  const [tracks, count, totais] = await Promise.all([
    query<Track>(`SELECT t.*, u.name AS autor, ${VOTOS_SQL},
        EXISTS (SELECT 1 FROM playlist_track_votes v WHERE v.track_id=t.id AND v.user_id=$3) AS votei
      FROM playlist_tracks t JOIN family_users u ON u.id=t.user_id
      WHERE t.ano=$1 AND t.momento=$2 AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id=$3 AND b.blocked_id=t.user_id)
      ORDER BY ${ORDEM_VOTOS}`, [ano, momento, me.id]),
    query<{ total: number }>('SELECT COUNT(*)::int AS total FROM playlist_tracks WHERE ano=$1 AND momento=$2 AND user_id=$3', [ano, momento, me.id]),
    query<{ momento: Momento; total: number }>('SELECT momento, COUNT(*)::int AS total FROM playlist_tracks WHERE ano=$1 GROUP BY momento', [ano]),
  ]);
  const playlistUrl = playlistId ? `https://open.spotify.com/playlist/${playlistId}` : null;
  return { ano, momento, connected, api, configured: configured(), playlist_url: playlistUrl,
    momentos: MOMENTO_IDS.map(id => ({ id, nome: MOMENTOS[id].nome, descricao: MOMENTOS[id].descricao,
      total: totais.rows.find(r => r.momento === id)?.total || 0 })),
    link: manual?.link || playlistUrl, embed_id: manual?.id || playlistId,
    tracks: tracks.rows.filter(t => !t.track_uri.startsWith(PEDIDO)),
    pedidos: tracks.rows.filter(t => t.track_uri.startsWith(PEDIDO)).reverse(),
    minhas: count.rows[0].total, limite: LIMITE_POR_MOMENTO };
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

export async function criarPedido(me: SessionUser, texto: unknown, momento: Momento = 'festa') {
  const pedido = parsePedido(texto);
  if (!pedido) throw new HttpError(400, 'Escreva a música e o artista (até 120 caracteres).');
  const ano = edicaoAtual();
  return transaction(async q => {
    await q('SELECT pg_advisory_xact_lock($1, $2)', [16003, ano]);
    const existing = await q('SELECT 1 FROM playlist_tracks WHERE ano=$1 AND momento=$2 AND track_uri=$3', [ano, momento, pedido.chave]);
    if (existing.rows.length) throw new HttpError(409, 'Já pediram essa.');
    const count = await q<{ total: number }>('SELECT COUNT(*)::int AS total FROM playlist_tracks WHERE ano=$1 AND momento=$2 AND user_id=$3', [ano, momento, me.id]);
    if (count.rows[0].total >= LIMITE_POR_MOMENTO) throw new HttpError(400, `Você já escolheu ${LIMITE_POR_MOMENTO} músicas para este momento. Remova uma para escolher outra.`);
    await q(`INSERT INTO playlist_tracks(ano,momento,user_id,track_uri,nome,artista,capa_url) VALUES ($1,$2,$3,$4,$5,$6,NULL)`,
      [ano, momento, me.id, pedido.chave, pedido.nome, pedido.artista]);
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

type ItemPlaylist = { item?: { uri: string } | null; track?: { uri: string } | null };

async function itensDaPlaylist(playlistId: string, access: string, paginas = 20): Promise<string[]> {
  const uris: string[] = [];
  for (let offset = 0, pagina = 0; pagina < paginas; offset += 50, pagina++) {
    const page = await spotify<{ items: ItemPlaylist[]; next: string | null }>(`/playlists/${playlistId}/items?limit=50&offset=${offset}`, 'GET', undefined, access);
    page.items.forEach((t, i) => uris.push((t.item || t.track)?.uri || `fora:${offset + i}`));
    if (!page.next) break;
  }
  return uris;
}

export async function containsTrack(playlistId: string, uri: string, access: string) {
  return (await itensDaPlaylist(playlistId, access, 200)).includes(uri);
}

export async function mutatePlaylist(me: SessionUser, uri: string, remove: boolean, momento: Momento = 'festa') {
  if (!/^spotify:track:[a-zA-Z0-9]{22}$/.test(uri)) throw new HttpError(400, 'Escolha uma música válida na busca.');
  const playlistId = await ensurePlaylist(momento);
  const access = await token();
  const ano = edicaoAtual();
  return transaction(async q => {
    await q('SELECT pg_advisory_xact_lock($1, $2)', [16003, ano]);
    const existing = await q<Track>('SELECT * FROM playlist_tracks WHERE ano=$1 AND momento=$2 AND track_uri=$3', [ano, momento, uri]);
    const track = existing.rows[0];
    if (remove) {
      if (!track) throw new HttpError(404, 'Esta música já foi removida.');
      if (track.user_id !== me.id && !me.is_admin) throw new HttpError(403, 'Só quem adicionou ou quem organiza pode remover.');
      await spotify(`/playlists/${playlistId}/items`, 'DELETE', { items: [{ uri }] }, access);
      await q('DELETE FROM playlist_tracks WHERE id=$1', [track.id]);
    } else {
      if (track) throw new HttpError(409, 'Essa música já está na playlist.');
      const count = await q<{ total: number }>('SELECT COUNT(*)::int AS total FROM playlist_tracks WHERE ano=$1 AND momento=$2 AND user_id=$3', [ano, momento, me.id]);
      if (count.rows[0].total >= LIMITE_POR_MOMENTO) throw new HttpError(400, `Você já escolheu ${LIMITE_POR_MOMENTO} músicas para este momento. Remova uma para escolher outra.`);
      const song = await spotify<SpotifyTrack>(`/tracks/${uri.split(':')[2]}`, 'GET', undefined, access);
      // Após uma resposta perdida, uma nova tentativa aproveita a música já enviada ao Spotify.
      if (!await containsTrack(playlistId, uri, access)) await spotify(`/playlists/${playlistId}/items`, 'POST', { uris: [uri] }, access);
      await q(`INSERT INTO playlist_tracks(ano,momento,user_id,track_uri,nome,artista,capa_url) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [ano, momento, me.id, uri, song.name, song.artists.map(a => a.name).join(', '), song.album.images[0]?.url || null]);
    }
    return { ok: true };
  });
}

/** Curtir ou tirar a curtida de uma música da edição atual. */
export async function votar(me: SessionUser, trackId: number) {
  return transaction(async q => {
    const { rows } = await q<{ momento: Momento }>(`SELECT momento FROM playlist_tracks WHERE id=$1 AND ano=$2 AND track_uri LIKE 'spotify:track:%' FOR SHARE`, [trackId, edicaoAtual()]);
    if (!rows[0]) throw new HttpError(404, 'Esta música já foi removida.');
    const removido = await q('DELETE FROM playlist_track_votes WHERE track_id=$1 AND user_id=$2', [trackId, me.id]);
    if (!removido.rowCount) await q('INSERT INTO playlist_track_votes(track_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [trackId, me.id]);
    const total = await q<{ total: number }>('SELECT COUNT(*)::int AS total FROM playlist_track_votes WHERE track_id=$1', [trackId]);
    return { ok: true, votou: !removido.rowCount, votos: total.rows[0].total, momento: rows[0].momento };
  });
}

const REORDENAR_INTERVALO_MS = 30 * 1000;
const REORDENAR_MAX_MOVIMENTOS = 60;

/** Ordem desejada: cada música conhecida ocupa as vagas das conhecidas, o resto da playlist fica onde está. Função pura. */
export function ordemFinal(atual: string[], desejada: string[]): string[] {
  const presentes = new Set(atual);
  const quer = desejada.filter(uri => presentes.has(uri));
  const conhecidas = new Set(quer);
  const alvo = atual.slice();
  let k = 0;
  atual.forEach((uri, i) => { if (conhecidas.has(uri) && k < quer.length) alvo[i] = quer[k++]; });
  return alvo;
}

/** Passos { de, para } que levam a lista atual à final, em ordem. Função pura. */
export function movimentos(atual: string[], alvo: string[]): { de: number; para: number }[] {
  const sim = atual.slice();
  const passos: { de: number; para: number }[] = [];
  for (let i = 0; i < alvo.length; i++) {
    if (sim[i] === alvo[i]) continue;
    const j = sim.indexOf(alvo[i], i + 1);
    if (j < 0) continue;
    passos.push({ de: j, para: i });
    sim.splice(i, 0, sim.splice(j, 1)[0]);
  }
  return passos;
}

/**
 * Deixa a playlist do momento na ordem dos votos. No máximo uma reordenação completa a cada 30 s por playlist;
 * se vier antes disso, fica marcada como pendente (a tarefa de ordem termina o serviço). Nunca lança erro.
 */
export async function reordenar(momento: Momento, ano = edicaoAtual()): Promise<boolean> {
  try {
    const s = await settings();
    const playlistId = playlistGuardada(s, momento, ano);
    if (!playlistId || !configured() || !s.spotify_refresh_token) return false;
    const agora = Date.now();
    const pendente = `spotify_reorder_pendente_${ano}_${momento}`;
    const vaga = await query(`INSERT INTO app_settings(key, value, updated_at) VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()
      WHERE CASE WHEN app_settings.value ~ '^[0-9]+$' THEN app_settings.value::bigint <= $3 ELSE TRUE END RETURNING key`,
    [`spotify_reorder_${ano}_${momento}`, String(agora), agora - REORDENAR_INTERVALO_MS]);
    if (!vaga.rowCount) { await save({ [pendente]: '1' }); return false; }
    await query('DELETE FROM app_settings WHERE key=$1', [pendente]);
    const desejada = (await query<{ track_uri: string }>(
      `SELECT t.track_uri, ${VOTOS_SQL} FROM playlist_tracks t WHERE t.ano=$1 AND t.momento=$2 AND t.track_uri LIKE 'spotify:track:%' ORDER BY ${ORDEM_VOTOS}`,
      [ano, momento])).rows.map(r => r.track_uri);
    if (desejada.length < 2) return true;
    const access = await token();
    const atual = await itensDaPlaylist(playlistId, access);
    const passos = movimentos(atual, ordemFinal(atual, desejada)).slice(0, REORDENAR_MAX_MOVIMENTOS);
    for (const passo of passos) {
      await spotify(`/playlists/${playlistId}/items`, 'PUT', { range_start: passo.de, insert_before: passo.para, range_length: 1 }, access);
    }
    return true;
  } catch {
    return false;
  }
}

/** Reordena as playlists que ficaram pendentes por causa do limite de 30 s. Usada pela tarefa de ordem. */
export async function reordenarPendentes(): Promise<number> {
  const ano = edicaoAtual();
  const s = await settings();
  let feitas = 0;
  for (const momento of MOMENTO_IDS) {
    if (s[`spotify_reorder_pendente_${ano}_${momento}`] && await reordenar(momento, ano)) feitas++;
  }
  return feitas;
}

export type Retrospectiva = Awaited<ReturnType<typeof retrospectiva>>;

/** Retrospectiva musical da edição: músicas mais votadas, quem mais adicionou, total por momento e artista mais pedido. */
export async function retrospectiva(me: SessionUser, ano = edicaoAtual()) {
  const naoBloqueado = `NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id=$2 AND b.blocked_id=t.user_id)`;
  const [votadas, autores, totais, artistas] = await Promise.all([
    query<{ track_uri: string; nome: string; artista: string; capa_url: string | null; momento: Momento; autor: string; votos: number }>(
      `SELECT t.track_uri, t.nome, t.artista, t.capa_url, t.momento, u.name AS autor, ${VOTOS_SQL}
       FROM playlist_tracks t JOIN family_users u ON u.id=t.user_id
       WHERE t.ano=$1 AND t.track_uri LIKE 'spotify:track:%' AND ${naoBloqueado}
         AND EXISTS (SELECT 1 FROM playlist_track_votes v WHERE v.track_id=t.id)
       ORDER BY ${ORDEM_VOTOS} LIMIT 5`, [ano, me.id]),
    query<{ nome: string; total: number }>(
      `SELECT u.name AS nome, COUNT(*)::int AS total FROM playlist_tracks t JOIN family_users u ON u.id=t.user_id
       WHERE t.ano=$1 AND ${naoBloqueado} GROUP BY u.id, u.name ORDER BY total DESC, u.name LIMIT 5`, [ano, me.id]),
    query<{ momento: Momento; total: number }>('SELECT momento, COUNT(*)::int AS total FROM playlist_tracks WHERE ano=$1 GROUP BY momento', [ano]),
    query<{ nome: string; total: number }>(
      `SELECT a.nome, COUNT(*)::int AS total
       FROM playlist_tracks t, LATERAL (SELECT BTRIM(x) AS nome FROM unnest(string_to_array(t.artista, ', ')) AS x) a
       WHERE t.ano=$1 AND a.nome <> '' GROUP BY a.nome ORDER BY total DESC, a.nome LIMIT 1`, [ano]),
  ]);
  const por_momento = MOMENTO_IDS.map(id => ({ id, nome: MOMENTOS[id].nome, total: totais.rows.find(r => r.momento === id)?.total || 0 }));
  return { ano, destaque: hojeSP() >= `${ano}-12-25`,
    mais_votadas: votadas.rows, quem_mais_adicionou: autores.rows, por_momento,
    total: por_momento.reduce((soma, m) => soma + m.total, 0), artista_mais_pedido: artistas.rows[0] || null };
}

const ESCOPO_TOCANDO = 'user-read-currently-playing';
export type Tocando = { precisa_reconectar: true } | { tocando: boolean; nome: string | null; artista: string | null; capa_url: string | null;
  progresso_ms: number; duracao_ms: number; adicionada_por: string | null };
let cacheTocando: { em: number; valor: Tocando } | null = null;

/** O que está tocando agora na conta do organizador (para o telão). */
export async function tocando(): Promise<Tocando> {
  if (cacheTocando && Date.now() - cacheTocando.em < 4000) return cacheTocando.valor;
  const s = await settings();
  const reconectar: Tocando = { precisa_reconectar: true };
  if (!configured() || !s.spotify_refresh_token) return reconectar;
  if (s.spotify_scope && !s.spotify_scope.split(' ').includes(ESCOPO_TOCANDO)) return reconectar;
  let agora: { is_playing?: boolean; progress_ms?: number; item?: { uri?: string; name?: string; duration_ms?: number;
    artists?: { name: string }[]; album?: { images?: { url: string }[] } } | null } | undefined;
  try {
    agora = await spotify(`/me/player/currently-playing?${new URLSearchParams({ market: 'BR', additional_types: 'track' })}`);
  } catch (error) {
    // Escopo que falta volta como 403 da Web API.
    if (error instanceof SpotifyForbidden) return reconectar;
    throw error;
  }
  const item = agora?.item;
  let valor: Tocando;
  if (!agora || !item) {
    valor = { tocando: false, nome: null, artista: null, capa_url: null, progresso_ms: 0, duracao_ms: 0, adicionada_por: null };
  } else {
    const dono = item.uri ? await query<{ autor: string }>(
      `SELECT u.name AS autor FROM playlist_tracks t JOIN family_users u ON u.id=t.user_id
       WHERE t.ano=$1 AND t.track_uri=$2 ORDER BY t.created_at LIMIT 1`, [edicaoAtual(), item.uri]) : null;
    valor = { tocando: Boolean(agora.is_playing), nome: item.name || null, artista: (item.artists || []).map(a => a.name).join(', ') || null,
      capa_url: item.album?.images?.[0]?.url || null, progresso_ms: agora.progress_ms || 0, duracao_ms: item.duration_ms || 0,
      adicionada_por: dono?.rows[0]?.autor || null };
  }
  cacheTocando = { em: Date.now(), valor };
  return valor;
}

// ---------- Player do telão (Web Playback SDK no navegador + Web API /me/player) ----------

export type PrecisaReconectar = { precisa_reconectar: true };
const RECONECTAR: PrecisaReconectar = { precisa_reconectar: true };
const ESCOPOS_PLAYER = ['streaming', 'user-read-playback-state', 'user-modify-playback-state'];
const SEM_TELAO = 'O telão não está conectado. Abra o telão no notebook e toque em Ligar a música.';
const ID_DEVICE = /^[a-zA-Z0-9_-]{8,80}$/;

/** Conectada com todos os escopos do player. Conexão antiga (sem registro de escopos) também pede reconexão. */
function escopoPlayerOk(s: Record<string, string>): boolean {
  if (!configured() || !s.spotify_refresh_token) return false;
  const tem = (s.spotify_scope || '').split(' ');
  return ESCOPOS_PLAYER.every(e => tem.includes(e));
}

async function deviceTelao(): Promise<string | null> {
  const { rows } = await query<{ value: string }>(`SELECT value FROM app_settings WHERE key='spotify_telao_device'`);
  return rows[0]?.value && ID_DEVICE.test(rows[0].value) ? rows[0].value : null;
}

/** Guarda o aparelho Spotify Connect do telão (o device_id muda a cada vez que o telão é aberto). */
export async function registrarTelao(deviceId: unknown) {
  if (typeof deviceId !== 'string' || !ID_DEVICE.test(deviceId)) throw new HttpError(400, 'Aparelho do telão inválido.');
  await save({ spotify_telao_device: deviceId });
  return { ok: true as const, device_id: deviceId };
}

/** Token da conta do organizador para o Web Playback SDK. Só chamar a partir de rota de admin. Renova se faltar menos de 5 min. */
export async function tokenDoPlayer(): Promise<{ access_token: string; expira_em: number } | PrecisaReconectar> {
  const antes = await settings();
  if (!escopoPlayerOk(antes)) return RECONECTAR;
  if (!(Number(antes.spotify_access_expires) - Date.now() > 5 * 60 * 1000)) {
    await query(`DELETE FROM app_settings WHERE key = 'spotify_access_expires'`);
  }
  const access_token = await token();
  const depois = await settings();
  return { access_token, expira_em: Number(depois.spotify_access_expires) || Date.now() + 55 * 60 * 1000 };
}

type RespostaPlayer = { status: number; data: any };

/** Chamada à Web API do player sem converter erro em exceção, para tratar 403/404 de cada comando. */
async function playerApi(path: string, method = 'GET', body?: object): Promise<RespostaPlayer> {
  const response = await safeFetch(`https://api.spotify.com/v1${path}`, {
    method, headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (response.status === 401) await query(`DELETE FROM app_settings WHERE key = 'spotify_access_expires'`);
  let data: any = null;
  if (response.status !== 204) { try { data = await response.json(); } catch { /* corpo vazio */ } }
  return { status: response.status, data };
}

export type AcaoPlayer = 'tocar' | 'pausar' | 'continuar' | 'proxima' | 'anterior' | 'volume' | 'aleatorio' | 'transferir';
export type OpcoesPlayer = { momento?: Momento; valor?: number; ligado?: boolean; device_id?: string };

/** Comando para o telão. Sem momento, 'tocar' usa a playlist geral (a da festa). Escopo faltando ou 401/403 devolve { precisa_reconectar: true }. */
export async function controlarPlayer(acao: AcaoPlayer, opts: OpcoesPlayer = {}): Promise<{ ok: true } | PrecisaReconectar> {
  const s = await settings();
  if (!escopoPlayerOk(s)) return RECONECTAR;
  const device = opts.device_id || await deviceTelao();
  if (!device) throw new HttpError(acao === 'transferir' ? 400 : 409, acao === 'transferir' ? 'Aparelho do telão inválido.' : SEM_TELAO);
  const com = (extra = '') => `?${[extra, `device_id=${encodeURIComponent(device)}`].filter(Boolean).join('&')}`;
  let r: RespostaPlayer;
  switch (acao) {
    case 'transferir': r = await playerApi('/me/player', 'PUT', { device_ids: [device], play: false }); break;
    case 'tocar': {
      const id = await ensurePlaylist(opts.momento ?? 'festa');
      r = await playerApi(`/me/player/play${com()}`, 'PUT', { context_uri: `spotify:playlist:${id}` });
      break;
    }
    case 'pausar': r = await playerApi(`/me/player/pause${com()}`, 'PUT'); break;
    case 'continuar': r = await playerApi(`/me/player/play${com()}`, 'PUT'); break;
    case 'proxima': r = await playerApi(`/me/player/next${com()}`, 'POST'); break;
    case 'anterior': r = await playerApi(`/me/player/previous${com()}`, 'POST'); break;
    case 'volume': {
      const v = Math.round(Number(opts.valor));
      if (!Number.isFinite(v)) throw new HttpError(400, 'Volume inválido.');
      r = await playerApi(`/me/player/volume${com(`volume_percent=${Math.min(100, Math.max(0, v))}`)}`, 'PUT');
      break;
    }
    case 'aleatorio': r = await playerApi(`/me/player/shuffle${com(`state=${opts.ligado ? 'true' : 'false'}`)}`, 'PUT'); break;
  }
  if (r.status >= 200 && r.status < 300) return { ok: true };
  const motivo = String(r.data?.error?.reason || '');
  const mensagem = String(r.data?.error?.message || '');
  if (r.status === 401) return RECONECTAR;
  if (r.status === 403) {
    if (motivo === 'PREMIUM_REQUIRED') throw new HttpError(403, 'A conta Spotify de quem organiza precisa ser Premium para tocar no telão.');
    if (/restriction/i.test(mensagem)) return { ok: true }; // comando que o Spotify não permite agora (ex.: voltar na primeira faixa)
    return RECONECTAR;
  }
  if (r.status === 404 || r.status === 400) {
    if (motivo === 'NO_ACTIVE_DEVICE' || /device/i.test(mensagem)) throw new HttpError(409, SEM_TELAO);
    if (acao === 'tocar') throw new HttpError(409, 'Não foi possível tocar este momento. A playlist pode estar vazia.');
  }
  throw friendly(r.status);
}

export type FaixaPlayer = { uri: string | null; nome: string; artista: string; capa: string | null; duracao_ms: number; posicao_ms: number };
export type EstadoPlayer = PrecisaReconectar | { telao_conectado: boolean; device: { id: string; nome: string } | null; tocando: boolean;
  volume: number | null; aleatorio: boolean; faixa: FaixaPlayer | null };

/** Estado do player: se o telão está online, o que toca nele, volume e aleatório. */
export async function lerPlayer(): Promise<EstadoPlayer> {
  const s = await settings();
  if (!escopoPlayerOk(s)) return RECONECTAR;
  const device = await deviceTelao();
  const [atual, lista] = await Promise.all([
    playerApi(`/me/player?${new URLSearchParams({ market: 'BR', additional_types: 'track' })}`),
    playerApi('/me/player/devices'),
  ]);
  for (const r of [atual, lista]) {
    if (r.status === 401 || r.status === 403) return RECONECTAR;
    if (r.status >= 400) throw friendly(r.status);
  }
  const aparelho = device ? (lista.data?.devices as { id: string; name: string; volume_percent: number | null }[] | undefined)?.find(d => d.id === device) : undefined;
  const noTelao = Boolean(device && atual.status === 200 && atual.data?.device?.id === device);
  const item = noTelao ? atual.data?.item : null;
  return {
    telao_conectado: Boolean(aparelho),
    device: aparelho ? { id: aparelho.id, nome: aparelho.name } : null,
    tocando: noTelao && Boolean(atual.data?.is_playing),
    volume: aparelho?.volume_percent ?? null,
    aleatorio: noTelao && Boolean(atual.data?.shuffle_state),
    faixa: item ? { uri: item.uri || null, nome: item.name || '', artista: ((item.artists || []) as { name: string }[]).map(a => a.name).join(', '),
      capa: item.album?.images?.[0]?.url || null, duracao_ms: item.duration_ms || 0, posicao_ms: atual.data?.progress_ms || 0 } : null,
  };
}
