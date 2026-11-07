// Contadores de depuração do modo estúdio no navegador (só com ?debug=1 na URL): taxa de quadros do detector, tom válido, erro em semitons,
// desvio de tempo estimado e latência aplicada. Exposto em window.__karaoke.estado(). Não afeta a pontuação.
import { erroEmSemitons, notaEm, type NotaEstudio } from './pontuacao';

const LAGS = Array.from({ length: 25 }, (_, i) => -600 + i * 50);

export type QuadroDep = { t: number; m: number; midi: number | null; valido: boolean; indice: number; clareza: number; rms: number; dt: number };

export class Depuracao {
  private quadros = 0;
  private primeiroT = -1;
  private ultimoT = 0;
  private maiorIntervalo = 0;
  private intervalosLongos = 0;
  private somaIntervalo = 0;
  private dentro = 0;
  private validos = 0;
  private comTom = 0;
  private somaErro = 0;
  private nErro = 0;
  private somaDt = 0;
  private somaClareza = 0;
  private lagContagem = LAGS.map(() => 0);
  private ultimoMs = -1;
  private repetidos = 0;
  info = { sampleRate: 0, baseLatency: 0, outputLatency: 0 };

  constructor(private readonly notas: readonly NotaEstudio[], public latenciaMs: number, public offsetMs: number) {}

  registrar(q: QuadroDep) {
    if (this.primeiroT < 0) this.primeiroT = q.t;
    else {
      const iv = q.t - this.ultimoT;
      this.somaIntervalo += iv;
      this.maiorIntervalo = Math.max(this.maiorIntervalo, iv);
      if (iv > 100) this.intervalosLongos++;
    }
    this.ultimoT = q.t;
    this.quadros++;
    this.somaDt += q.dt;
    if (q.m === this.ultimoMs) this.repetidos++;
    this.ultimoMs = q.m;
    if (q.midi !== null) this.comTom++;
    if (q.indice >= 0) {
      this.dentro++;
      if (q.valido) {
        this.validos++;
        this.somaClareza += q.clareza;
        const nota = this.notas[q.indice];
        if (nota && q.midi !== null) { this.somaErro += erroEmSemitons(q.midi, nota.midi); this.nErro++; }
      }
    }
    // Desvio de tempo: com que atraso da voz em relação às notas mais quadros válidos acertam (erro <= 1 semitom), sem latência.
    if (q.valido && q.midi !== null) {
      const base = q.m - this.offsetMs;
      LAGS.forEach((lag, k) => {
        const i = notaEm(this.notas, base - lag);
        if (i >= 0 && erroEmSemitons(q.midi as number, this.notas[i].midi) <= 1) this.lagContagem[k]++;
      });
    }
  }

  estado() {
    const n = Math.max(1, this.quadros - 1);
    let melhor = 0;
    this.lagContagem.forEach((c, k) => { if (c > this.lagContagem[melhor]) melhor = k; });
    const duracao = (this.ultimoT - Math.max(0, this.primeiroT)) / 1000;
    return {
      quadros: this.quadros,
      quadrosPorSegundo: duracao > 0 ? Math.round((this.quadros / duracao) * 10) / 10 : 0,
      intervaloMedioMs: Math.round((this.somaIntervalo / n) * 10) / 10,
      maiorIntervaloMs: Math.round(this.maiorIntervalo),
      intervalosAcima100ms: this.intervalosLongos,
      dtMedioMs: Math.round((this.somaDt / Math.max(1, this.quadros)) * 10) / 10,
      posicaoRepetida: this.repetidos,
      quadrosComTomPct: this.quadros ? Math.round((this.comTom / this.quadros) * 1000) / 10 : 0,
      quadrosDentroDasNotas: this.dentro,
      tomValidoDentroPct: this.dentro ? Math.round((this.validos / this.dentro) * 1000) / 10 : 0,
      erroMedioSemitons: this.nErro ? Math.round((this.somaErro / this.nErro) * 100) / 100 : null,
      clarezaMedia: this.validos ? Math.round((this.somaClareza / this.validos) * 100) / 100 : null,
      desvioEstimadoMs: this.lagContagem[melhor] > 20 ? LAGS[melhor] : null,
      curvaDesvio: Object.fromEntries(LAGS.map((l, k) => [l, this.lagContagem[k]])),
      latenciaAplicadaMs: this.latenciaMs,
      offsetAplicadoMs: this.offsetMs,
      audio: this.info,
    };
  }
}
