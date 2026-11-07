// Regras dos melhores momentos do karaokê (clipes e fotos). Funções e classes puras, sem imports: testadas por momentos.test.mjs.
//
// Como o clipe é montado: um arquivo webm só é válido se começa no primeiro pedaço do MediaRecorder (o cabeçalho). Por isso há
// sempre DOIS gravadores alternados: a cada PASSO_SEGMENTO_MS abre-se um novo e, ao abrir o n-ésimo, fecha-se o (n-2). Cada gravador
// vive VIDA_SEGMENTO_MS (= 2 passos) e guarda todos os pedaços desde o início dele. No gatilho (instante T) escolhe-se o gravador mais
// novo que começou pelo menos PRE_ROLL_MS antes de T; 4 s depois de T monta-se o arquivo com os pedaços dele até aquele momento.
// Como o gravador seguinte abre a cada 8 s, o clipe sempre cobre de 4 a 12 s antes de T e 4 s depois (8 a 16 s no total).

export const PRE_ROLL_MS = 4000;
export const POS_ROLL_MS = 4000;
export const PASSO_SEGMENTO_MS = 8000;
export const VIDA_SEGMENTO_MS = 2 * PASSO_SEGMENTO_MS;
export const MAX_CLIPES = 3;
export const MAX_FOTOS = 6;
export const INTERVALO_CLIPES_MS = 20000;
/** Frase avaliada PERFEITO (mesmo corte do texto "PERFEITO!" no palco). */
export const PERFEICAO_FRASE = 0.9;
/** Sequência a partir da qual vale um clipe (x3 e x4). */
export const COMBO_CLIPE = 3;

export type Motivo = 'frase' | 'combo' | 'estrela';

export const ROTULO_MOTIVO: Record<Motivo, string> = {
  frase: 'Frase perfeita',
  combo: 'Sequência incrível',
  estrela: 'Modo Estrela',
};

/** Limites por música: no máximo 3 clipes (1 a cada 20 s) e 6 fotos. */
export class PlanejadorMomentos {
  private clipes = 0;
  private fotos = 0;
  private ultimoClipe = -Infinity;

  reiniciar() { this.clipes = 0; this.fotos = 0; this.ultimoClipe = -Infinity; }
  get totalClipes(): number { return this.clipes; }
  get totalFotos(): number { return this.fotos; }

  /** Pede uma foto; true se ainda cabe (e já conta). */
  pedirFoto(): boolean {
    if (this.fotos >= MAX_FOTOS) return false;
    this.fotos++;
    return true;
  }

  /** Pede um clipe no instante agoraMs (relógio em ms); true se cabe e passou o intervalo (e já conta). */
  pedirClipe(agoraMs: number): boolean {
    if (this.clipes >= MAX_CLIPES || agoraMs - this.ultimoClipe < INTERVALO_CLIPES_MS) return false;
    this.clipes++;
    this.ultimoClipe = agoraMs;
    return true;
  }

  /** Devolve um clipe que não chegou a ser gravado (o pedido não pode gastar a cota). */
  devolverClipe() { if (this.clipes > 0) this.clipes--; this.ultimoClipe = -Infinity; }
}

/** Um gravador: início no relógio (ms) e vida máxima. */
export type SegmentoGravacao = { inicio: number; vida: number };

/**
 * Escolhe o gravador do gatilho em t: o mais novo que começou há pelo menos preMs e ainda grava até t + posMs.
 * Se nenhum começou há tanto tempo (gatilho no começo da música), o mais antigo que cobre t + posMs. Devolve o índice ou -1.
 */
export function escolherSegmento(segmentos: readonly SegmentoGravacao[], t: number, preMs = PRE_ROLL_MS, posMs = POS_ROLL_MS): number {
  let melhor = -1;
  for (let i = 0; i < segmentos.length; i++) {
    const s = segmentos[i];
    if (s.inicio > t - preMs || s.inicio + s.vida < t + posMs) continue;
    if (melhor < 0 || s.inicio > segmentos[melhor].inicio) melhor = i;
  }
  if (melhor >= 0) return melhor;
  for (let i = 0; i < segmentos.length; i++) {
    const s = segmentos[i];
    if (s.inicio > t || s.inicio + s.vida < t + posMs) continue;
    if (melhor < 0 || s.inicio < segmentos[melhor].inicio) melhor = i;
  }
  if (melhor >= 0) return melhor;
  // Sem cobertura completa: o que ainda grava por mais tempo.
  for (let i = 0; i < segmentos.length; i++) {
    const s = segmentos[i];
    if (s.inicio > t) continue;
    if (melhor < 0 || s.inicio + s.vida > segmentos[melhor].inicio + segmentos[melhor].vida) melhor = i;
  }
  return melhor;
}

// ---------- linha da letra para o desenho do vídeo ----------

export type LinhaProgresso = { palavras: string[]; /** quantas palavras já foram cantadas */ cantadas: number };

/** Linha da letra do estúdio em ms (palavra a palavra); null em intervalos longos. */
export function linhaEstudioEm(
  linhas: readonly { inicio_ms: number; fim_ms: number; palavras: readonly { texto: string; inicio_ms: number; fim_ms: number }[] }[],
  ms: number,
): LinhaProgresso | null {
  let atual = -1;
  for (let i = 0; i < linhas.length; i++) {
    if (linhas[i].inicio_ms - 1200 <= ms) atual = i; else break;
  }
  if (atual < 0) return null;
  const l = linhas[atual];
  if (ms > l.fim_ms + 2500 || !l.palavras.length) return null;
  return { palavras: l.palavras.map((p) => p.texto), cantadas: l.palavras.filter((p) => p.inicio_ms <= ms).length };
}

/** Linha da letra sincronizada (modo letra) em ms; o preenchimento segue as faixas de cada palavra. */
export function linhaLetraEm(
  linhas: readonly { palavras: readonly string[]; faixas: readonly { de: number; ate: number }[]; ini: number; fim: number }[],
  ms: number,
): LinhaProgresso | null {
  let atual = -1;
  for (let i = 0; i < linhas.length; i++) {
    if (linhas[i].ini - 1200 <= ms) atual = i; else break;
  }
  if (atual < 0) return null;
  const l = linhas[atual];
  if (ms > l.fim + 2500 || !l.palavras.length) return null;
  const prog = l.fim > l.ini ? (ms - l.ini) / (l.fim - l.ini) : 1;
  return { palavras: [...l.palavras], cantadas: l.faixas.filter((f) => prog >= f.de).length };
}

/** Quebra a lista de palavras em linhas que cabem em maxLargura, medindo cada palavra com medir(). Devolve índices [de, ate) de cada linha. */
export function quebrarPalavras(palavras: readonly string[], medir: (texto: string) => number, maxLargura: number): [number, number][] {
  const saida: [number, number][] = [];
  let de = 0;
  let largura = 0;
  const espaco = medir(' ');
  for (let i = 0; i < palavras.length; i++) {
    const w = medir(palavras[i]);
    const novo = largura === 0 ? w : largura + espaco + w;
    if (novo > maxLargura && i > de) { saida.push([de, i]); de = i; largura = w; } else largura = novo;
  }
  if (de < palavras.length) saida.push([de, palavras.length]);
  return saida;
}
