// LRCLIB (letras sincronizadas): busca de músicas e leitura de uma faixa, com cache em memória de 10 min.

export type LinhaLetra = { ms: number; texto: string };

export interface FaixaLrclib {
  id: number;
  faixa: string;
  artista: string;
  album: string;
  duracao_s: number | null;
  sincronizada: boolean;
}

export interface FaixaCompleta extends FaixaLrclib {
  lrc: string | null;
}

const UA = { 'User-Agent': 'NatalEmFamilia/1.0 (https://natalemfamilia.com.br)' };
const CACHE_MS = 10 * 60 * 1000;
const MAX_CACHE = 150;

function memo<T>() {
  const mapa = new Map<string, { em: number; v: T }>();
  return {
    ler(k: string): T | null {
      const c = mapa.get(k);
      if (c && Date.now() - c.em < CACHE_MS) return c.v;
      mapa.delete(k);
      return null;
    },
    guardar(k: string, v: T) {
      if (mapa.size >= MAX_CACHE) { const velha = mapa.keys().next().value; if (velha !== undefined) mapa.delete(velha); }
      mapa.set(k, { em: Date.now(), v });
    },
  };
}
const cacheBusca = memo<FaixaLrclib[]>();
const cacheFaixa = memo<FaixaCompleta>();

interface Registro {
  id?: number;
  trackName?: string;
  name?: string;
  artistName?: string;
  albumName?: string;
  duration?: number | null;
  instrumental?: boolean;
  syncedLyrics?: string | null;
}

function paraFaixa(r: Registro): FaixaCompleta | null {
  if (typeof r.id !== 'number' || !Number.isFinite(r.id)) return null;
  const faixa = String(r.trackName ?? r.name ?? '').trim().slice(0, 150);
  if (!faixa) return null;
  const dur = typeof r.duration === 'number' && r.duration > 0 ? Math.round(r.duration) : null;
  const lrc = typeof r.syncedLyrics === 'string' && r.syncedLyrics.trim() ? r.syncedLyrics : null;
  return { id: r.id, faixa, artista: String(r.artistName ?? '').trim().slice(0, 120), album: String(r.albumName ?? '').trim().slice(0, 120), duracao_s: dur, sincronizada: Boolean(lrc), lrc };
}

/** "[mm:ss.xx] texto" (aceita vários carimbos na mesma linha). Linha sem texto = pausa instrumental. Função pura. */
export function parseLrc(lrc: string): LinhaLetra[] {
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

async function lrclib(caminho: string): Promise<unknown> {
  const res = await fetch(`https://lrclib.net/api/${caminho}`, { headers: UA, cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`lrclib ${res.status}`);
  return res.json();
}

/** Músicas que casam com a busca; as de letra sincronizada vêm primeiro (a ordem do LRCLIB é mantida dentro de cada grupo). */
export async function buscarMusicas(q: string): Promise<FaixaLrclib[]> {
  const chave = q.toLowerCase();
  const guardado = cacheBusca.ler(chave);
  if (guardado) return guardado;
  const dados = await lrclib(`search?${new URLSearchParams({ q })}`);
  const lista = Array.isArray(dados) ? (dados as Registro[]) : [];
  const vistos = new Set<string>();
  const faixas: FaixaLrclib[] = [];
  for (const r of lista) {
    if (r.instrumental) continue;
    const f = paraFaixa(r);
    if (!f) continue;
    const dup = `${f.faixa.toLowerCase()}|${f.artista.toLowerCase()}|${f.duracao_s ?? 0}`;
    if (vistos.has(dup)) continue;
    vistos.add(dup);
    const { lrc: _lrc, ...resumo } = f;
    void _lrc;
    faixas.push(resumo);
  }
  const ordenadas = [...faixas.filter((f) => f.sincronizada), ...faixas.filter((f) => !f.sincronizada)].slice(0, 15);
  cacheBusca.guardar(chave, ordenadas);
  return ordenadas;
}

/** Uma faixa pelo id, com a letra sincronizada (LRC) se houver. null = não existe. */
export async function lerFaixa(id: number): Promise<FaixaCompleta | null> {
  const chave = String(id);
  const guardada = cacheFaixa.ler(chave);
  if (guardada) return guardada;
  const dados = await lrclib(`get/${id}`);
  const f = dados && typeof dados === 'object' ? paraFaixa(dados as Registro) : null;
  if (f) cacheFaixa.guardar(chave, f);
  return f;
}
