import { route, ok, cleanText, HttpError, requireUser } from '@/app/lib/api';
import { dentroDoLimite } from '@/app/lib/limite';

export const dynamic = 'force-dynamic';

interface VideoKaraoke {
  video_id: string;
  titulo: string;
  canal: string;
  duracao_s: number | null;
  miniatura: string;
}

const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { em: number; videos: VideoKaraoke[] }>();

function lerCache(chave: string): VideoKaraoke[] | null {
  const c = cache.get(chave);
  if (c && Date.now() - c.em < CACHE_MS) return c.videos;
  cache.delete(chave);
  return null;
}

function guardarCache(chave: string, videos: VideoKaraoke[]) {
  if (cache.size >= 150) {
    const velha = cache.keys().next().value;
    if (velha !== undefined) cache.delete(velha);
  }
  cache.set(chave, { em: Date.now(), videos });
}

const miniaturaDe = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

/** Extrai o id de um link do YouTube (watch, youtu.be, shorts, embed, live) ou de um id solto. */
function idDoLink(texto: string): string | null {
  const t = texto.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(t)) {
    // Id solto só vale se parecer id (dígito, _ ou -, ou mistura de maiúscula e minúscula): evita tratar palavra comum de 11 letras como vídeo.
    return /[0-9_-]/.test(t) || (/[a-z]/.test(t) && /[A-Z]/.test(t)) ? t : null;
  }
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    const host = u.hostname.replace(/^(www|m|music)\./, '');
    let id: string | null = null;
    if (host === 'youtu.be') id = u.pathname.split('/')[1] ?? null;
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else {
        const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/);
        id = m ? m[1] : null;
      }
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** "3:45" ou "1:02:03" para segundos. */
function duracaoTexto(t: string | undefined): number | null {
  if (!t) return null;
  const partes = t.split(':').map(Number);
  if (partes.some((n) => !Number.isFinite(n))) return null;
  return partes.reduce((acc, n) => acc * 60 + n, 0) || null;
}

/** PT1H2M3S para segundos. */
function duracaoIso(iso: string | undefined): number | null {
  const m = iso?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  return (Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0)) || null;
}

const ESCAPES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const desescapar = (s: string) => s.replace(/&(?:amp|lt|gt|quot|#39);/g, (m) => ESCAPES[m] ?? m);

async function buscarComChave(termo: string, chave: string): Promise<VideoKaraoke[]> {
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.search = new URLSearchParams({ part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: '12', q: termo, key: chave, regionCode: 'BR', relevanceLanguage: 'pt' }).toString();
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`YouTube Data API ${r.status}`);
  const j = (await r.json()) as { items?: { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string } }[] };
  const base = (j.items ?? []).filter((i) => i.id?.videoId).map((i) => ({
    video_id: i.id!.videoId!,
    titulo: desescapar(i.snippet?.title ?? ''),
    canal: desescapar(i.snippet?.channelTitle ?? ''),
    duracao_s: null as number | null,
    miniatura: miniaturaDe(i.id!.videoId!),
  }));
  if (base.length) {
    try {
      const d = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${base.map((b) => b.video_id).join(',')}&key=${chave}`, { signal: AbortSignal.timeout(8000) });
      if (d.ok) {
        const dj = (await d.json()) as { items?: { id: string; contentDetails?: { duration?: string } }[] };
        const mapa = new Map((dj.items ?? []).map((i) => [i.id, duracaoIso(i.contentDetails?.duration)]));
        for (const b of base) b.duracao_s = mapa.get(b.video_id) ?? null;
      }
    } catch { /* duração é um enfeite */ }
  }
  return base;
}

/** Sem chave: lê a página de resultados do YouTube e extrai o ytInitialData. Pode quebrar se o YouTube mudar a página. */
async function buscarSemChave(termo: string): Promise<VideoKaraoke[]> {
  const r = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(termo)}&hl=pt-BR&gl=BR`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept-Language': 'pt-BR,pt;q=0.9',
      Cookie: 'CONSENT=YES+1; SOCS=CAI',
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`YouTube ${r.status}`);
  const html = await r.text();
  const ini = html.indexOf('ytInitialData');
  if (ini < 0) throw new Error('ytInitialData não encontrado');
  const abre = html.indexOf('{', ini);
  const fim = html.indexOf(';</script>', abre);
  if (abre < 0 || fim < 0) throw new Error('ytInitialData incompleto');
  const dados: unknown = JSON.parse(html.slice(abre, fim));
  const achados: Record<string, any>[] = [];
  const percorrer = (no: unknown, prof: number) => {
    if (!no || typeof no !== 'object' || prof > 14 || achados.length >= 40) return;
    if (Array.isArray(no)) { for (const x of no) percorrer(x, prof + 1); return; }
    const o = no as Record<string, any>;
    if (o.videoRenderer && typeof o.videoRenderer === 'object') { achados.push(o.videoRenderer); return; }
    for (const k of Object.keys(o)) percorrer(o[k], prof + 1);
  };
  percorrer(dados, 0);
  const vistos = new Set<string>();
  const videos: VideoKaraoke[] = [];
  for (const v of achados) {
    const id = typeof v.videoId === 'string' ? v.videoId : '';
    const duracao = duracaoTexto(v.lengthText?.simpleText);
    if (!/^[\w-]{11}$/.test(id) || vistos.has(id) || !duracao) continue; // sem duração = ao vivo ou anúncio
    vistos.add(id);
    videos.push({
      video_id: id,
      titulo: String(Array.isArray(v.title?.runs) ? v.title.runs.map((r: { text?: string }) => r.text ?? '').join('') : (v.title?.simpleText ?? '')).slice(0, 200),
      canal: String(v.ownerText?.runs?.[0]?.text ?? '').slice(0, 120),
      duracao_s: duracao,
      miniatura: miniaturaDe(id),
    });
    if (videos.length >= 12) break;
  }
  return videos;
}

/** Dados de um vídeo colado pelo link (oEmbed não precisa de chave). */
async function resolverLink(id: string, chave: string | undefined): Promise<VideoKaraoke[]> {
  if (chave) {
    const d = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${id}&key=${chave}`, { signal: AbortSignal.timeout(8000) });
    if (d.ok) {
      const j = (await d.json()) as { items?: { snippet?: { title?: string; channelTitle?: string }; contentDetails?: { duration?: string }; status?: { embeddable?: boolean } }[] };
      const v = j.items?.[0];
      if (!v) return [];
      if (v.status?.embeddable === false) throw new HttpError(400, 'Esse vídeo não permite ser tocado fora do YouTube. Escolha outro.');
      return [{ video_id: id, titulo: desescapar(v.snippet?.title ?? 'Karaokê'), canal: desescapar(v.snippet?.channelTitle ?? ''), duracao_s: duracaoIso(v.contentDetails?.duration), miniatura: miniaturaDe(id) }];
    }
  }
  const o = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`, { signal: AbortSignal.timeout(8000) });
  if (o.status === 401 || o.status === 403) throw new HttpError(400, 'Esse vídeo não permite ser tocado fora do YouTube. Escolha outro.');
  if (!o.ok) return [];
  const j = (await o.json()) as { title?: string; author_name?: string };
  return [{ video_id: id, titulo: String(j.title ?? 'Karaokê').slice(0, 200), canal: String(j.author_name ?? '').slice(0, 120), duracao_s: null, miniatura: miniaturaDe(id) }];
}

export const GET = route(async (req) => {
  const me = await requireUser();
  if (!dentroDoLimite('karaoke-buscar', me.id, 10)) throw new HttpError(429, 'Muitas buscas seguidas. Espere um minutinho e tente de novo.');
  const q = cleanText(new URL(req.url).searchParams.get('q'), 'a busca', 120);
  const chave = process.env.YOUTUBE_API_KEY || undefined;
  const id = idDoLink(q);
  const termo = /karaok/i.test(q) ? q : `${q} karaokê`;
  const chaveCache = id ? `v:${id}` : `q:${chave ? 'api' : 'web'}:${termo.toLowerCase()}`;
  const guardado = lerCache(chaveCache);
  if (guardado) return ok({ videos: guardado, link: Boolean(id) });
  let videos: VideoKaraoke[];
  try {
    videos = id ? await resolverLink(id, chave) : chave ? await buscarComChave(termo, chave) : await buscarSemChave(termo);
  } catch (err) {
    if (err instanceof HttpError) throw err;
    console.error('[karaoke] busca:', err);
    throw new HttpError(502, 'Não consegui buscar no YouTube agora. Tente de novo ou cole o link do vídeo.');
  }
  if (videos.length) guardarCache(chaveCache, videos);
  return ok({ videos, link: Boolean(id) });
});
