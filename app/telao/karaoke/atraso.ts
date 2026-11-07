// Medição do atraso da voz (Voz na TV): toca um pulso curto pela saída, grava pelo microfone e acha o pico por correlação.
// Funções puras, sem imports: testadas por atraso.test.mjs.

/** Acima disso o painel avisa e dá dicas; acima de ALTO_MS sugere desligar a Voz na TV. */
export const ATRASO_AVISO_MS = 60;
export const ATRASO_ALTO_MS = 120;
/** Margem somada ao atraso medido para o atraso da pontuação (quem canta responde um pouco depois do que ouve). */
export const MARGEM_PONTUACAO_MS = 40;
const LATENCIA_MAX_PONTUACAO_MS = 400;
/** O pico precisa passar disso vezes o segundo melhor (longe dele) para valer como "ouvi o pulso". */
const RAZAO_MINIMA = 2.5;

/** Pulso de 3 ms: varredura de 1,5 a 5 kHz com janela de Hann (curto, mas com banda larga para a correlação ser nítida). */
export function gerarPulso(sampleRate: number) {
  const n = Math.max(16, Math.round(sampleRate * 0.003));
  const p = new Float32Array(n);
  const f0 = 1500;
  const f1 = 5000;
  const T = n / sampleRate;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const fase = 2 * Math.PI * (f0 * t + ((f1 - f0) / (2 * T)) * t * t);
    p[i] = Math.sin(fase) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  }
  return p;
}

export type Achado = { indice: number; razao: number };

/** Onde o pulso começa dentro da captura (em amostras, com refinamento parabólico), ou null se não houver pico claro. */
export function acharPulso(captura: ArrayLike<number>, pulso: ArrayLike<number>): Achado | null {
  const n = captura.length;
  const m = pulso.length;
  if (n <= m + 2) return null;
  let media = 0;
  for (let i = 0; i < n; i++) media += captura[i];
  media /= n;
  const c = new Float64Array(n - m);
  for (let k = 0; k < c.length; k++) {
    let s = 0;
    for (let i = 0; i < m; i++) s += (captura[k + i] - media) * pulso[i];
    c[k] = Math.abs(s);
  }
  let melhor = 0;
  for (let k = 1; k < c.length; k++) if (c[k] > c[melhor]) melhor = k;
  // O pico vale se for bem maior que o melhor candidato a mais de ~30 ms dele (reflexões da sala ficam perto) (ruído e eco curto não têm um pico dominante).
  let segundo = 0;
  for (let k = 0; k < c.length; k++) if (Math.abs(k - melhor) > Math.max(2 * m, 1500) && c[k] > segundo) segundo = c[k];
  const razao = c[melhor] / (segundo + 1e-12);
  if (!(razao >= RAZAO_MINIMA) || c[melhor] <= 0) return null;
  let delta = 0;
  if (melhor > 0 && melhor < c.length - 1) {
    const a = c[melhor - 1];
    const b = c[melhor];
    const d = c[melhor + 1];
    const den = a - 2 * b + d;
    if (den < 0) delta = Math.max(-0.5, Math.min(0.5, (0.5 * (a - d)) / den));
  }
  return { indice: melhor + delta, razao };
}

export function medianaDeAtrasos(valores: readonly number[]): number | null {
  if (!valores.length) return null;
  const o = [...valores].sort((a, b) => a - b);
  const meio = o.length >> 1;
  return o.length % 2 ? o[meio] : (o[meio - 1] + o[meio]) / 2;
}

/** As medições valem se pelo menos duas das três ficam a 20 ms da mediana (sem pulso de verdade, a correlação acha picos soltos e espalhados). */
export function medicoesConsistentes(valores: readonly number[]): boolean {
  const m = medianaDeAtrasos(valores);
  if (m === null) return false;
  return valores.filter((v) => Math.abs(v - m) <= 20).length >= Math.min(2, valores.length);
}

export type Avaliacao = { nivel: 'bom' | 'aviso' | 'alto'; texto: string };

export const DICAS_ATRASO = 'Ligue o Modo Jogo da TV; use cabo em vez de Bluetooth; se o seu mixer tiver retorno direto (direct monitor), ligue o microfone nele e desligue a Voz na TV.';

export function avaliarAtraso(ms: number): Avaliacao {
  if (ms > ATRASO_ALTO_MS) return { nivel: 'alto', texto: `Atraso alto (${Math.round(ms)} ms): ouvir a própria voz com esse atraso atrapalha mais que ajuda. Desligue a Voz na TV. ${DICAS_ATRASO}` };
  if (ms > ATRASO_AVISO_MS) return { nivel: 'aviso', texto: `Atraso acima de ${ATRASO_AVISO_MS} ms. ${DICAS_ATRASO}` };
  return { nivel: 'bom', texto: 'Atraso baixo: dá para cantar com a Voz na TV.' };
}

/** Atraso do microfone da pontuação (ms) calibrado pelo atraso total medido, dentro do limite do controle. */
export function latenciaDaPontuacao(atrasoMs: number): number {
  return Math.max(0, Math.min(LATENCIA_MAX_PONTUACAO_MS, Math.round((atrasoMs + MARGEM_PONTUACAO_MS) / 10) * 10));
}
