import { HttpError, ok, requireUser, route } from '@/app/lib/api';
import { dentroDoLimite } from '@/app/lib/limite';

// Letra sincronizada (formato LRC) do LRCLIB, para o karaokê do telão. Cache em memória por 6 h.
type LinhaLetra = { ms: number; texto: string };

const UA = { 'User-Agent': 'NatalEmFamilia/1.0 (https://natalemfamilia.com.br)' };
const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHE = 300;
const cache = new Map<string, { em: number; linhas: LinhaLetra[] }>();

/** "[mm:ss.xx] texto" (aceita vários carimbos na mesma linha). Função pura. */
function parseLrc(lrc: string): LinhaLetra[] {
  const linhas: LinhaLetra[] = [];
  for (const bruta of lrc.split(/\r?\n/)) {
    const carimbos = [...bruta.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if (!carimbos.length) continue;
    const texto = bruta.replace(/\[[^\]]*\]/g, '').trim().slice(0, 200);
    for (const c of carimbos) {
      const fr = c[3] ?? '';
      const frMs = fr ? Math.round(Number(fr) * 10 ** (3 - fr.length)) : 0;
      linhas.push({ ms: (Number(c[1]) * 60 + Number(c[2])) * 1000 + frMs, texto });
    }
  }
  return linhas.sort((a, b) => a.ms - b.ms).slice(0, 500);
}

type Registro = { syncedLyrics?: string | null; duration?: number | null };

async function lrclib(path: string, params: Record<string, string>): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`https://lrclib.net/api/${path}?${new URLSearchParams(params)}`, { headers: UA, cache: 'no-store', signal: AbortSignal.timeout(6000) });
  if (res.status === 404) return { status: 404, data: null };
  if (!res.ok) throw new Error(`lrclib ${res.status}`);
  return { status: 200, data: await res.json() };
}

async function buscar(nome: string, artista: string, duracaoS: number): Promise<LinhaLetra[]> {
  const base: Record<string, string> = { artist_name: artista, track_name: nome, ...(duracaoS ? { duration: String(duracaoS) } : {}) };
  const direto = await lrclib('get', base);
  let sincronizada = (direto.data as Registro | null)?.syncedLyrics || '';
  if (!sincronizada) {
    // /get exige correspondência exata; a busca tolera pequenas diferenças de nome e duração.
    const busca = await lrclib('search', { artist_name: artista, track_name: nome });
    const lista = Array.isArray(busca.data) ? busca.data as Registro[] : [];
    sincronizada = lista.find(r => r.syncedLyrics && (!duracaoS || !r.duration || Math.abs(r.duration - duracaoS) <= 5))?.syncedLyrics || '';
  }
  return sincronizada ? parseLrc(sincronizada) : [];
}

export const GET = route(async req => {
  const me = await requireUser();
  if (!dentroDoLimite('telao-letra', me.id, 20)) throw new HttpError(429, 'Muitas buscas de letra seguidas. Espere um minutinho.');
  const p = new URL(req.url).searchParams;
  const nome = (p.get('nome') || '').trim().slice(0, 200);
  const artista = (p.get('artista') || '').split(',')[0].trim().slice(0, 200);
  const duracaoMs = Number(p.get('duracao_ms'));
  const duracaoS = Number.isFinite(duracaoMs) && duracaoMs > 0 ? Math.round(duracaoMs / 1000) : 0;
  if (!nome) return ok({ linhas: [] });
  const chave = `${nome.toLowerCase()}|${artista.toLowerCase()}|${duracaoS}`;
  const guardada = cache.get(chave);
  if (guardada && Date.now() - guardada.em < TTL_MS) return ok({ linhas: guardada.linhas });
  let linhas: LinhaLetra[];
  try {
    linhas = await buscar(nome, artista, duracaoS);
  } catch {
    return ok({ linhas: [] }); // falha de rede não entra no cache: tenta de novo na próxima
  }
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
  cache.set(chave, { em: Date.now(), linhas });
  return ok({ linhas });
});
