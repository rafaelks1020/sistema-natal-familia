// Linha do tempo da letra sincronizada do karaokê. Funções puras, sem imports: testadas por letra.test.mjs.

export type LinhaLetra = { ms: number; texto: string };

export type LinhaCantada = {
  /** Posição entre as linhas COM texto. */
  i: number;
  texto: string;
  palavras: string[];
  /** Fração da linha (0 a 1) em que cada palavra começa e termina, proporcional ao número de letras. */
  faixas: { de: number; ate: number }[];
  /** ms em que a linha entra. */
  ini: number;
  /** ms em que o preenchimento termina (um pouco antes da linha seguinte). */
  fim: number;
  /** ms em que a janela de canto da linha termina (usada na nota). */
  janelaFim: number;
};

export type Cena = {
  /** 'linha': mostra a linha em ant; 'pausa': intervalo instrumental (♪ ♪ ♪). */
  tipo: 'linha' | 'pausa';
  /** Índice da última linha que já entrou (-1 antes da primeira). */
  ant: number;
  /** Índice da próxima linha (linhas.length se não houver). */
  prox: number;
  /** Pontinhos ainda acesos na contagem para a próxima linha (0 a 3). */
  pontos: number;
};

/** Termina o preenchimento antes da linha seguinte. */
export const FOLGA_FIM_MS = 250;
/** Depois de preenchida, a linha fica na tela esse tempo antes de virar ♪ (só em intervalos longos). */
export const SEGURA_LINHA_MS = 1500;
/** Intervalo (entre o fim do preenchimento e a próxima linha) acima do qual aparece o ♪ ♪ ♪. */
export const PAUSA_LONGA_MS = 6000;
export const CONTAGEM_PONTOS_MS = 3000;
const PREENCHE_MIN_MS = 300;
const ULTIMA_LINHA_MS = 6000;

const limitar = (x: number, min = 0, max = 1) => (x < min ? min : x > max ? max : x);

/** Quanto uma linha pode durar cantada: evita preencher devagar demais quando a próxima só vem muito depois. */
function limiteDeCanto(letras: number): number {
  return Math.max(3500, letras * 450);
}

/** Linhas com texto, já com os tempos. Linhas vazias do LRC marcam o fim da anterior (pausa instrumental). */
export function prepararLetra(bruta: readonly LinhaLetra[] | null | undefined): LinhaCantada[] {
  if (!Array.isArray(bruta)) return [];
  const lista: readonly LinhaLetra[] = bruta;
  const todas = lista
    .filter((l): boolean => Boolean(l) && Number.isFinite(l.ms) && l.ms >= 0 && typeof l.texto === 'string')
    .map((l) => ({ ms: l.ms, texto: l.texto.replace(/\s+/g, ' ').trim() }))
    .sort((a, b) => a.ms - b.ms);
  const saida: LinhaCantada[] = [];
  for (let k = 0; k < todas.length; k++) {
    const l = todas[k];
    if (!l.texto) continue;
    const palavras = l.texto.split(' ');
    const letras = palavras.reduce((a, p) => a + p.length, 0) || 1;
    const proxMs = k + 1 < todas.length ? todas[k + 1].ms : l.ms + ULTIMA_LINHA_MS;
    const janelaFim = Math.min(Math.max(proxMs, l.ms + PREENCHE_MIN_MS), l.ms + limiteDeCanto(letras));
    const fim = Math.max(l.ms + PREENCHE_MIN_MS, janelaFim - FOLGA_FIM_MS);
    let acumulado = 0;
    const faixas = palavras.map((p) => {
      const de = acumulado / letras;
      acumulado += p.length;
      return { de, ate: acumulado / letras };
    });
    saida.push({ i: saida.length, texto: l.texto, palavras, faixas, ini: l.ms, fim, janelaFim });
  }
  return saida;
}

/** Quanto da linha já foi cantado em t (0 a 1). */
export function progressoLinha(l: Pick<LinhaCantada, 'ini' | 'fim'>, t: number): number {
  return limitar((t - l.ini) / Math.max(1, l.fim - l.ini));
}

/** Quanto de uma palavra está preenchido, dado o progresso da linha. */
export function progressoPalavra(faixa: { de: number; ate: number }, progresso: number): number {
  return limitar((progresso - faixa.de) / Math.max(1e-6, faixa.ate - faixa.de));
}

/** O que mostrar no instante t (ms da música, já com o ajuste de tempo). */
export function cenaEm(linhas: readonly LinhaCantada[], t: number): Cena {
  let ant = -1;
  for (let k = 0; k < linhas.length && linhas[k].ini <= t; k++) ant = k;
  const prox = ant + 1;
  const proxIni = prox < linhas.length ? linhas[prox].ini : Infinity;
  let tipo: Cena['tipo'] = 'pausa';
  if (ant >= 0) {
    const l = linhas[ant];
    const espera = proxIni - l.fim;
    if (t < l.fim + SEGURA_LINHA_MS || espera <= PAUSA_LONGA_MS) tipo = 'linha';
  }
  let pontos = 0;
  if (tipo === 'pausa' && prox < linhas.length) {
    const falta = proxIni - t;
    pontos = falta >= CONTAGEM_PONTOS_MS ? 3 : Math.max(0, Math.floor(falta / 1000));
  }
  return { tipo, ant, prox, pontos };
}

/** Janelas (ms da música no relógio do vídeo, já somado o ajuste) em que há letra sendo cantada: base da nota. */
export function janelasDaLetra(linhas: readonly LinhaCantada[], offsetMs: number): { de: number; ate: number }[] {
  return linhas.map((l) => ({ de: l.ini + offsetMs, ate: l.janelaFim + offsetMs }));
}
