'use client';

// Cache do telão (Cache Storage, nome karaoke-v1).
// A tela lê palavras e notas em GET /api/karaoke/fila?letra=1, no campo estudio
// da música que está cantando. GET /api/karaoke/musica só busca no LRCLIB.
// O JSON que dá para guardar antes, um por faixa pronta, é GET /api/karaoke/catalogo/:id
// (audio_url, palavras, notas). O instrumental é o audio_url
// (https://arquivos.natalemfamilia.com.br/f/...).

export const NOME_CACHE = 'karaoke-v1';
export const ROTA_CATALOGO = '/api/karaoke/catalogo';
/** Rede lenta: a busca de JSON desiste e usa o que já está salvo. */
export const TIMEOUT_JSON_MS = 4000;
/** Instrumental (arquivo grande): desiste e a tela pode baixar de novo. */
export const TIMEOUT_AUDIO_MS = 60_000;

export type MusicaParaOffline = { id: number; status: string };

export type FaltaBaixar = {
  id: number;
  jsonUrl: string;
  /** Null quando o JSON ainda não foi lido e a lista do catálogo não traz o áudio. */
  audioUrl: string | null;
  json: boolean;
  audio: boolean;
};

export type PlanoOffline = { falta: FaltaBaixar[]; prontas: number; total: number };

export type EstadoOffline = { musicas: number; total: number; bytes: number };

/** Corpo de GET /api/karaoke/catalogo/:id (o que a tela precisa para tocar no estúdio). */
export type JsonMusicaOffline = {
  id: number;
  slug: string;
  artista: string;
  faixa: string;
  status: string;
  capa_url: string | null;
  duracao_ms: number | null;
  lrclib_id: number | null;
  audio_url: string | null;
  palavras: unknown;
  notas: unknown;
};

const objetos = new Map<string, string>();
let geracao = 0;
/** Object URL que o <audio> está usando agora: nunca é revogado enquanto estiver em uso. */
let emUso: string | null = null;
/** Object URLs que ficaram de fora de uma limpeza por estarem em uso. Saem quando o áudio troca. */
const adiados = new Set<string>();

/** Informa qual src o <audio> do telão está tocando (ou null). Solta a faixa anterior e o que ficou adiado. */
export function marcarEmUso(src: string | null): void {
  const proximo = src && src.startsWith('blob:') ? src : null;
  const anterior = emUso;
  emUso = proximo;
  if (anterior && anterior !== proximo) {
    adiados.delete(anterior);
    for (const [chave, obj] of objetos) {
      if (obj === anterior) { objetos.delete(chave); break; }
    }
    URL.revokeObjectURL(anterior);
  }
  for (const obj of [...adiados]) {
    if (obj === emUso) continue;
    URL.revokeObjectURL(obj);
    adiados.delete(obj);
  }
}

function revogar(obj: string): void {
  if (obj === emUso) { adiados.add(obj); return; }
  URL.revokeObjectURL(obj);
}

/** Caminho do JSON de uma faixa do catálogo. */
export function urlJsonDaMusica(id: number): string {
  return `/api/karaoke/catalogo/${id}`;
}

/**
 * Chave estável no cache. Rotas /api/karaoke ficam só no caminho (o domínio muda entre
 * o aparelho e o teste). O instrumental fica na URL completa, sem âncora.
 */
export function chaveCache(url: string): string {
  const bruto = url.trim();
  if (!bruto) return '';
  try {
    const origem = typeof location !== 'undefined' && location.origin ? location.origin : 'https://natalemfamilia.com.br';
    const u = new URL(bruto, origem);
    u.hash = '';
    if (u.pathname.startsWith('/api/karaoke/')) return u.pathname + u.search;
    return u.href;
  } catch {
    return bruto;
  }
}

/** MB com vírgula, estável no servidor e no navegador. */
export function formatarTamanho(bytes: number): string {
  const n = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** Lê o array musicas de GET /api/karaoke/catalogo. Ignora o que não tem id e status. */
export function musicasDoCatalogo(dado: unknown): MusicaParaOffline[] {
  if (!dado || typeof dado !== 'object') return [];
  const lista = (dado as { musicas?: unknown }).musicas;
  if (!Array.isArray(lista)) return [];
  const saida: MusicaParaOffline[] = [];
  for (const item of lista) {
    if (!item || typeof item !== 'object') continue;
    const id = (item as { id?: unknown }).id;
    const status = (item as { status?: unknown }).status;
    if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) continue;
    if (typeof status !== 'string') continue;
    saida.push({ id, status });
  }
  return saida;
}

/** audio_url do JSON da faixa, ou null. */
export function audioDaMusica(dado: unknown): string | null {
  if (!dado || typeof dado !== 'object') return null;
  const url = (dado as { audio_url?: unknown }).audio_url;
  return typeof url === 'string' && url.trim() ? url.trim() : null;
}

function conjunto(urls: ReadonlySet<string>): Set<string> {
  const s = new Set<string>();
  for (const u of urls) s.add(chaveCache(u));
  return s;
}

/**
 * O que ainda falta baixar. Música pronta offline: JSON do catálogo e instrumental no cache.
 * Faixa que não está pronta fica de fora. Id repetido conta uma vez.
 */
export function oQueFaltaBaixar(
  musicas: readonly MusicaParaOffline[],
  urlsNoCache: ReadonlySet<string>,
  audioPorId: ReadonlyMap<number, string | null>,
): PlanoOffline {
  const tem = conjunto(urlsNoCache);
  const vistas = new Set<number>();
  const falta: FaltaBaixar[] = [];
  let prontas = 0;
  let total = 0;
  for (const m of musicas) {
    if (m.status !== 'pronta' || vistas.has(m.id)) continue;
    vistas.add(m.id);
    total += 1;
    const jsonUrl = urlJsonDaMusica(m.id);
    const temJson = tem.has(chaveCache(jsonUrl));
    const bruto = audioPorId.get(m.id);
    const audioUrl = typeof bruto === 'string' && bruto.trim() ? bruto.trim() : null;
    const temAudio = audioUrl !== null && tem.has(chaveCache(audioUrl));
    if (temJson && temAudio) {
      prontas += 1;
      continue;
    }
    falta.push({ id: m.id, jsonUrl, audioUrl, json: !temJson, audio: !temAudio });
  }
  return { falta, prontas, total };
}

function cancelado(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError';
}

function abortado(): Error {
  const e = new Error('Download cancelado.');
  e.name = 'AbortError';
  return e;
}

function temCaches(): boolean {
  return typeof caches !== 'undefined' && typeof caches.open === 'function';
}

async function abrir(): Promise<Cache> {
  if (!temCaches()) throw new Error('Este navegador não guarda arquivos para uso sem internet.');
  return caches.open(NOME_CACHE);
}

async function erroHttp(res: Response): Promise<Error> {
  let msg = '';
  try {
    const j = await res.clone().json() as { error?: unknown };
    if (j && typeof j.error === 'string' && j.error.trim()) msg = j.error.trim();
  } catch { /* corpo que não é JSON */ }
  return new Error(msg || `Não consegui baixar (${res.status}).`);
}

async function guardarBytes(url: string, corpo: ArrayBuffer, tipo: string, g: number): Promise<void> {
  if (g !== geracao) throw abortado();
  const cache = await abrir();
  if (g !== geracao) throw abortado();
  const headers = new Headers();
  headers.set('content-type', tipo);
  headers.set('content-length', String(corpo.byteLength));
  try {
    await cache.put(url, new Response(corpo, { status: 200, headers }));
  } catch (err) {
    if (g !== geracao) throw abortado();
    throw err;
  }
  if (g !== geracao) {
    try { await cache.delete(url); } catch { /* o cache já foi apagado */ }
    throw abortado();
  }
}

async function guardarTexto(url: string, texto: string, tipo: string | null, g: number): Promise<number> {
  const corpo = new TextEncoder().encode(texto);
  const buf = new ArrayBuffer(corpo.byteLength);
  new Uint8Array(buf).set(corpo);
  await guardarBytes(url, buf, tipo || 'application/json; charset=utf-8', g);
  return corpo.byteLength;
}

async function lerJsonUrl(url: string): Promise<unknown | null> {
  if (!temCaches()) return null;
  try {
    const cache = await abrir();
    const hit = await cache.match(url);
    if (!hit) return null;
    return await hit.json() as unknown;
  } catch {
    return null;
  }
}

async function chavesDoCache(cache: Cache): Promise<Set<string>> {
  const reqs = await cache.keys();
  const s = new Set<string>();
  for (const req of reqs) s.add(chaveCache(req.url));
  return s;
}

async function somarBytes(cache: Cache): Promise<number> {
  const reqs = await cache.keys();
  let total = 0;
  for (const req of reqs) {
    const res = await cache.match(req);
    if (!res) continue;
    const n = Number(res.headers.get('content-length'));
    if (Number.isFinite(n) && n >= 0) total += n;
    else total += (await res.blob()).size;
  }
  return total;
}

async function mapaDeAudio(cache: Cache, urls: Set<string>, lista: MusicaParaOffline[] | null): Promise<Map<number, string | null>> {
  const ids = new Set<number>();
  if (lista) for (const m of lista) if (m.status === 'pronta') ids.add(m.id);
  for (const u of urls) {
    const achou = /^\/api\/karaoke\/catalogo\/(\d+)$/.exec(u);
    if (achou) ids.add(Number(achou[1]));
  }
  const mapa = new Map<number, string | null>();
  for (const id of ids) {
    if (!urls.has(urlJsonDaMusica(id))) continue;
    const hit = await cache.match(urlJsonDaMusica(id));
    if (!hit) continue;
    try { mapa.set(id, audioDaMusica(await hit.json())); } catch { mapa.set(id, null); }
  }
  return mapa;
}

function soltarObjeto(url: string) {
  const chave = chaveCache(url);
  const obj = objetos.get(chave);
  if (!obj) return;
  revogar(obj);
  objetos.delete(chave);
}

type Rede = { dado: unknown; bytes: number };

/** Busca JSON na rede e grava no cache. timeoutMs null espera até o sinal. */
async function buscarNaRede(url: string, sinal: AbortSignal | undefined, timeoutMs: number | null): Promise<Rede> {
  const ctrl = new AbortController();
  const noPai = () => ctrl.abort();
  sinal?.addEventListener('abort', noPai, { once: true });
  const timer = timeoutMs != null ? setTimeout(() => ctrl.abort(), timeoutMs) : 0;
  const g = geracao;
  try {
    if (sinal?.aborted || g !== geracao) throw abortado();
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (g !== geracao) throw abortado();
    if (!res.ok) throw await erroHttp(res);
    const texto = await res.text();
    if (sinal?.aborted || g !== geracao) throw abortado();
    let dado: unknown;
    try { dado = JSON.parse(texto) as unknown; } catch { throw new Error('Resposta inválida.'); }
    const bytes = await guardarTexto(url, texto, res.headers.get('content-type'), g);
    return { dado, bytes };
  } finally {
    if (timer) clearTimeout(timer);
    sinal?.removeEventListener('abort', noPai);
  }
}

async function baixarArquivo(url: string, sinal: AbortSignal | undefined): Promise<number> {
  const ctrl = new AbortController();
  const noPai = () => ctrl.abort();
  sinal?.addEventListener('abort', noPai, { once: true });
  let estourou = false;
  const timer = setTimeout(() => { estourou = true; ctrl.abort(); }, TIMEOUT_AUDIO_MS);
  const g = geracao;
  try {
    if (sinal?.aborted || g !== geracao) throw abortado();
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (g !== geracao) throw abortado();
    if (!res.ok) throw await erroHttp(res);
    const buf = await res.arrayBuffer();
    if (sinal?.aborted || g !== geracao) throw abortado();
    soltarObjeto(url);
    const tipo = res.headers.get('content-type') || 'application/octet-stream';
    await guardarBytes(url, buf, tipo, g);
    return buf.byteLength;
  } catch (err) {
    if (sinal?.aborted || g !== geracao) throw cancelado(err) ? err : abortado();
    if (estourou) throw new Error('O download do instrumental demorou demais. Tente de novo.');
    throw err;
  } finally {
    clearTimeout(timer);
    sinal?.removeEventListener('abort', noPai);
  }
}

async function obterCatalogo(sinal?: AbortSignal): Promise<MusicaParaOffline[]> {
  const g = geracao;
  try {
    const { dado } = await buscarNaRede(ROTA_CATALOGO, sinal, null);
    return musicasDoCatalogo(dado);
  } catch (err) {
    if (cancelado(err) || g !== geracao) throw cancelado(err) ? err : abortado();
    const salvo = await lerJsonUrl(ROTA_CATALOGO);
    if (salvo && typeof salvo === 'object') return musicasDoCatalogo(salvo);
    throw new Error('Não consegui ler o catálogo. Tente de novo com a internet melhor.');
  }
}

/**
 * Baixa o JSON e o instrumental de cada música pronta. O que já está no cache é pulado.
 * aoProgresso: quantas já estão prontas, quantas são prontas no catálogo, bytes guardados.
 */
export async function baixarTudo(
  aoProgresso: (feitos: number, total: number, bytes: number) => void,
  sinal?: AbortSignal,
): Promise<void> {
  const musicas = await obterCatalogo(sinal);
  const cache = await abrir();
  const urls = await chavesDoCache(cache);
  const audioPorId = await mapaDeAudio(cache, urls, musicas);
  const plano = oQueFaltaBaixar(musicas, urls, audioPorId);
  let bytes = await somarBytes(cache);
  let feitos = plano.prontas;
  aoProgresso(feitos, plano.total, bytes);

  let falhas = 0;
  for (const item of plano.falta) {
    if (sinal?.aborted) throw abortado();
    try {
      let audioUrl = item.audioUrl;
      if (item.json) {
        const baixado = await buscarNaRede(item.jsonUrl, sinal, null);
        bytes += baixado.bytes;
        audioUrl = audioDaMusica(baixado.dado);
      }
      if (item.audio) {
        if (!audioUrl) throw new Error('Essa música não tem instrumental.');
        if (!urls.has(chaveCache(audioUrl))) {
          bytes += await baixarArquivo(audioUrl, sinal);
          urls.add(chaveCache(audioUrl));
        }
      }
      feitos += 1;
    } catch (err) {
      if (cancelado(err)) throw err;
      falhas += 1;
    }
    aoProgresso(feitos, plano.total, bytes);
  }

  if (falhas > 0) {
    const n = falhas === 1 ? '1 música' : `${falhas} músicas`;
    throw new Error(`Não consegui baixar ${n}. As outras ficaram salvas neste aparelho.`);
  }
}

/** Object URL do instrumental em cache, ou a própria URL se ainda não foi salvo. */
export async function urlDoAudio(url: string): Promise<string> {
  if (!url) return url;
  const chave = chaveCache(url);
  const ja = objetos.get(chave);
  if (ja) return ja;
  if (!temCaches()) return url;
  try {
    const cache = await abrir();
    const hit = await cache.match(url);
    if (!hit) return url;
    const blob = await hit.blob();
    if (!blob.size) return url;
    const obj = URL.createObjectURL(blob);
    objetos.set(chave, obj);
    return obj;
  } catch {
    return url;
  }
}

/**
 * JSON da rede, com limite de 4 s. Se a rede falhar ou demorar, devolve o cache.
 * Resposta boa da rede é gravada no cache.
 */
export async function buscarJson<T = unknown>(url: string): Promise<T> {
  const g = geracao;
  try {
    const { dado } = await buscarNaRede(url, undefined, TIMEOUT_JSON_MS);
    return dado as T;
  } catch (err) {
    if (g !== geracao) throw abortado();
    const salvo = await lerJsonUrl(url);
    if (salvo !== null) return salvo as T;
    if (cancelado(err)) throw new Error('A rede demorou demais e essa resposta não está salva neste aparelho.');
    throw err instanceof Error ? err : new Error('Não consegui buscar os dados.');
  }
}

/** Músicas prontas já completas no cache, total de prontas do catálogo e bytes guardados. */
export async function estadoCache(): Promise<EstadoOffline> {
  if (!temCaches()) return { musicas: 0, total: 0, bytes: 0 };
  let lista: MusicaParaOffline[] | null = null;
  try {
    lista = musicasDoCatalogo(await buscarJson(ROTA_CATALOGO));
  } catch { lista = null; }
  try {
    const cache = await abrir();
    const urls = await chavesDoCache(cache);
    const bytes = await somarBytes(cache);
    const audioPorId = await mapaDeAudio(cache, urls, lista);
    if (lista) {
      const plano = oQueFaltaBaixar(lista, urls, audioPorId);
      return { musicas: plano.prontas, total: plano.total, bytes };
    }
    let musicas = 0;
    let total = 0;
    for (const [id, audio] of audioPorId) {
      if (!urls.has(urlJsonDaMusica(id))) continue;
      total += 1;
      if (audio && urls.has(chaveCache(audio))) musicas += 1;
    }
    return { musicas, total, bytes };
  } catch {
    return { musicas: 0, total: 0, bytes: 0 };
  }
}

/** Apaga o cache do karaokê e solta os object URLs (menos o que o áudio está usando agora). Cancela o download em andamento. */
export async function limparCache(): Promise<void> {
  geracao += 1;
  controleDownload?.abort();
  for (const obj of objetos.values()) revogar(obj);
  objetos.clear();
  if (!temCaches()) return;
  await caches.delete(NOME_CACHE);
}

/**
 * O instrumental em cache não tocou (arquivo corrompido ou incompleto): tira essa entrada do mapa e do
 * Cache Storage para a próxima vez buscar na rede. Devolve true se achou o object URL.
 */
export async function descartarDoCache(objUrl: string): Promise<boolean> {
  let chaveAchada: string | null = null;
  for (const [chave, obj] of objetos) {
    if (obj === objUrl) { chaveAchada = chave; break; }
  }
  if (chaveAchada === null) return false;
  objetos.delete(chaveAchada);
  if (objUrl === emUso) emUso = null;
  URL.revokeObjectURL(objUrl);
  adiados.delete(objUrl);
  if (temCaches()) {
    try { await (await abrir()).delete(chaveAchada); } catch { /* o cache já foi apagado */ }
  }
  return true;
}

// ---------- download em segundo plano (sobrevive ao painel fechado) ----------

export type EstadoDownload = { baixando: boolean; feitos: number; total: number; bytes: number; erro: string };

const DOWNLOAD_PARADO: EstadoDownload = { baixando: false, feitos: 0, total: 0, bytes: 0, erro: '' };
let estadoDownload: EstadoDownload = DOWNLOAD_PARADO;
let controleDownload: AbortController | null = null;
const ouvintes = new Set<() => void>();

function mudarDownload(novo: Partial<EstadoDownload>): void {
  estadoDownload = { ...estadoDownload, ...novo };
  for (const fn of [...ouvintes]) fn();
}

/** Estado atual (mesmo objeto até mudar: serve de snapshot para useSyncExternalStore). */
export function lerDownload(): EstadoDownload { return estadoDownload; }
export function lerDownloadServidor(): EstadoDownload { return DOWNLOAD_PARADO; }

/** Assina as mudanças do download. Devolve a função que cancela a assinatura. */
export function assinarDownload(fn: () => void): () => void {
  ouvintes.add(fn);
  return () => { ouvintes.delete(fn); };
}

/** Começa a baixar o catálogo pronto. Não faz nada se já está baixando. O estado fica neste módulo. */
export function iniciarDownload(): void {
  if (estadoDownload.baixando) return;
  const ctrl = new AbortController();
  controleDownload = ctrl;
  mudarDownload({ baixando: true, erro: '' });
  void baixarTudo((feitos, total, bytes) => { if (controleDownload === ctrl) mudarDownload({ feitos, total, bytes }); }, ctrl.signal)
    .catch((err: unknown) => {
      if (!cancelado(err) && controleDownload === ctrl) mudarDownload({ erro: err instanceof Error ? err.message : 'Não consegui baixar as músicas.' });
    })
    .finally(() => {
      if (controleDownload === ctrl) { controleDownload = null; mudarDownload({ baixando: false }); }
    });
}

/** Cancela o download em andamento (sem apagar o que já foi salvo). */
export function cancelarDownload(): void { controleDownload?.abort(); }
