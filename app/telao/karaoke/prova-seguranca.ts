import type { NotaEstudio, Quadro } from './pontuacao';

/**
 * Defesas do servidor contra quadros fabricados na Prova oficial. O cliente manda os quadros de voz prontos, então não
 * existe defesa perfeita: aqui só se marca o que é improvável para uma voz humana e a organização confere (vídeo da
 * apresentação, botão Anular). A marca nunca altera a nota nem bloqueia ninguém.
 *
 * Limiares (medidos só nos quadros com voz: 70 a 1200 Hz, volume > 0,004 e clareza >= 0,5, igual ao motor de nota):
 * - Mínimo de 300 quadros com voz (cerca de 10 s) para qualquer teste estatístico, evitando marcar tentativa curta.
 * - Clareza: desvio padrão < 0,01. Voz real oscila na casa de 0,05 a 0,15.
 * - Volume: desvio padrão / média < 0,03. Voz real tem dinâmica (coeficiente acima de 0,25).
 * - Afinação: mediana do desvio até a nota-alvo (oitava ignorada) < 3 centésimos de semitom E percentil 90 < 8.
 *   Voz real, mesmo afinada, tem vibrato e instabilidade: mediana de 15 a 30 e percentil 90 acima de 40 centésimos.
 * - Tempo: desvio padrão dos intervalos entre quadros (até 100 ms) < 0,15 ms. O navegador entrega instantes com
 *   folga de 1 a 3 ms por causa do relógio do áudio e da página.
 * - Posição: desvio padrão de (m - t) < 0,05 ms. A posição do áudio sempre tem jitter no navegador de verdade.
 * - Nota final >= 97 (inclui o teto de 100): rara numa música inteira no Difícil, sempre vale conferir.
 */
export const LIMIARES_SUSPEITA = {
  minimoQuadros: 300, clarezaDesvio: 0.01, volumeCoeficiente: 0.03, afinacaoMediana: 3, afinacaoP90: 8,
  intervaloDesvio: 0.15, posicaoDesvio: 0.05, notaAlta: 97, latenciaMs: 140,
} as const;

const media = (v: readonly number[]) => v.reduce((s, x) => s + x, 0) / v.length;
const desvio = (v: readonly number[]) => { const m = media(v); return Math.sqrt(media(v.map((x) => (x - m) ** 2))); };
const percentil = (v: readonly number[], p: number) => { const o = [...v].sort((a, b) => a - b); return o[Math.min(o.length - 1, Math.floor((o.length - 1) * p))]; };
const arred = (x: number, casas = 2) => Math.round(x * 10 ** casas) / 10 ** casas;

function centsAteNota(hz: number, midi: number): number {
  const p = 69 + 12 * Math.log2(hz / 440);
  const r = (((p - midi + 6) % 12) + 12) % 12;
  return Math.abs(r - 6) * 100;
}

function notaAtiva(notas: readonly NotaEstudio[], ms: number): NotaEstudio | null {
  let lo = 0; let hi = notas.length - 1; let achada = -1;
  while (lo <= hi) { const meio = (lo + hi) >> 1; if (notas[meio].inicio_ms <= ms) { achada = meio; lo = meio + 1; } else hi = meio - 1; }
  // Notas podem se sobrepor: confere as vizinhas anteriores.
  for (let i = achada; i >= 0 && i > achada - 4; i--) if (ms < notas[i].inicio_ms + notas[i].dur_ms) return notas[i];
  return null;
}

/** Motivos legíveis (para a organização) pelos quais a tentativa merece conferência. Vazio quando nada chama atenção. */
export function analisarSuspeita(quadros: readonly Quadro[], notas: readonly NotaEstudio[], nota: number): string[] {
  const L = LIMIARES_SUSPEITA;
  const motivos: string[] = [];
  const ordenados = [...quadros].sort((a, b) => a.t - b.t);
  const voz = ordenados.filter((q) => q.hz >= 70 && q.hz <= 1200 && q.rms > 0.004 && q.clareza >= 0.5);
  if (voz.length >= L.minimoQuadros) {
    const dc = desvio(voz.map((q) => q.clareza));
    if (dc < L.clarezaDesvio) motivos.push(`Clareza quase constante (desvio ${arred(dc, 4)})`);
    const rms = voz.map((q) => q.rms);
    const cv = desvio(rms) / media(rms);
    if (cv < L.volumeCoeficiente) motivos.push(`Volume quase constante (variação ${arred(cv, 4)})`);
    const ordemNotas = [...notas].sort((a, b) => a.inicio_ms - b.inicio_ms);
    const erros: number[] = [];
    for (const q of voz) {
      if (typeof q.m !== 'number') continue;
      const alvo = notaAtiva(ordemNotas, q.m - L.latenciaMs);
      if (alvo) erros.push(centsAteNota(q.hz, alvo.midi));
    }
    if (erros.length >= 200) {
      const med = percentil(erros, 0.5); const p90 = percentil(erros, 0.9);
      if (med < L.afinacaoMediana && p90 < L.afinacaoP90) motivos.push(`Afinação perfeita demais (mediana ${arred(med)} e percentil 90 de ${arred(p90)} centésimos de semitom)`);
    }
  }
  if (ordenados.length >= L.minimoQuadros) {
    const dt: number[] = [];
    for (let i = 1; i < ordenados.length; i++) { const d = ordenados[i].t - ordenados[i - 1].t; if (d > 0 && d <= 100) dt.push(d); }
    if (dt.length >= L.minimoQuadros - 1) {
      const dd = desvio(dt);
      if (dd < L.intervaloDesvio) motivos.push(`Intervalos de tempo regulares demais (desvio ${arred(dd, 4)} ms)`);
    }
    const dif = ordenados.filter((q) => typeof q.m === 'number').map((q) => (q.m as number) - q.t);
    if (dif.length >= L.minimoQuadros && desvio(dif) < L.posicaoDesvio) motivos.push('Posição do áudio acompanha o relógio de forma rígida demais');
  }
  if (nota >= L.notaAlta) motivos.push(`Nota ${nota} (97 ou mais)`);
  return motivos;
}

export interface EstadoLote { ultimo: number; posicao: number; duracaoMs: number; decorridoMs: number }
export interface ResultadoLote { novos: Quadro[]; ultimo: number; posicao: number; descartados: number; salto: boolean; loteAteT: number }

/**
 * Filtra um lote de quadros do cliente. Quadro malformado é descartado e o resto segue (um quadro ruim não derruba o lote).
 * Reenvio (t <= último aceito) é ignorado. Só salto de posição impossível (voltar mais de 200 ms ou passar do relógio real)
 * é sinalizado em `salto`, para o servidor responder 400. `loteAteT` é o maior t visto no lote (aceito ou descartado), para o
 * cliente não reenviar para sempre um quadro descartado.
 */
export function processarLote(brutos: readonly unknown[], e: EstadoLote): ResultadoLote {
  let { ultimo, posicao } = e;
  let descartados = 0; let loteAteT = ultimo; let salto = false;
  const novos: Quadro[] = [];
  for (const bruto of brutos) {
    const f = bruto as Partial<Quadro> | null;
    const valido = !!f && typeof f === 'object' && [f.t, f.m, f.hz, f.clareza, f.rms].every((v) => typeof v === 'number' && Number.isFinite(v))
      && f.t! >= 0 && f.hz! >= 0 && f.hz! <= 24000 && f.clareza! >= 0 && f.clareza! <= 1 && f.rms! >= 0 && f.rms! <= 2
      && f.m! >= -200 && f.m! <= e.duracaoMs + 1000 && f.t! <= e.decorridoMs;
    if (!valido) {
      descartados++;
      if (typeof f?.t === 'number' && Number.isFinite(f.t) && f.t <= e.decorridoMs) loteAteT = Math.max(loteAteT, f.t);
      continue;
    }
    const q = f as Quadro & { m: number };
    loteAteT = Math.max(loteAteT, q.t);
    if (q.t <= ultimo) continue;
    if (q.m < posicao - 200 || q.m > e.decorridoMs) { salto = true; break; }
    novos.push({ t: q.t, m: q.m, hz: q.hz, clareza: q.clareza, rms: q.rms });
    ultimo = q.t; posicao = q.m;
  }
  return { novos, ultimo, posicao, descartados, salto, loteAteT };
}
