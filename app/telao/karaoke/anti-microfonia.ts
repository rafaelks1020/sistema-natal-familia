// Detecção de microfonia (retorno) da "Voz na TV". Funções puras, sem imports: testadas por anti-microfonia.test.mjs.
// A microfonia aparece como um pico estreito e isolado no espectro que fica parado numa frequência e cresce. Voz cantada tem pico forte
// nos harmônicos, mas eles formam uma família (o dobro e o triplo da frequência também aparecem) e oscilam com o vibrato.

export type OpcoesDetector = {
  sampleRate: number;
  fftSize: number;
  /** Faixa onde procura (Hz). */
  minHz?: number;
  maxHz?: number;
  /** Quanto o pico precisa estar acima da mediana das vizinhanças (dB). Padrão 16. */
  acimaDb?: number;
  /** Tempo parado na mesma frequência para valer (ms). */
  persisteMs?: number;
  /** Ou: tempo mínimo e crescimento (dB) para valer mais cedo. */
  cresceMs?: number;
  cresceDb?: number;
  /** Nível mínimo absoluto do pico (dB, como o AnalyserNode). */
  nivelMinDb?: number;
  /** Intervalo mínimo entre avisos do mesmo pico (ms). */
  avisoCadaMs?: number;
};

export type Pico = { bin: number; hz: number; nivelDb: number; excessoDb: number };
export type Deteccao = { hz: number; bin: number; nivelDb: number; excessoDb: number; cresceu: boolean; duracaoMs: number };

const VIZ_PERTO = 4;
const VIZ_LONGE = 24;
/** Se o dobro, o triplo ou a metade da frequência está a menos disso do pico, é voz ou instrumento (harmônicos), não retorno. */
const HARMONICO_DB = 12;
const PENTE_MIN = 6;
const PENTE_MAX = 100;
const PENTE_EXCESSO_DB = 15;
/** Para contar como pente, o vizinho precisa estar quase no mesmo nível (o apito costuma passar de longe de tudo o mais). */
const PENTE_DB = 8;

const mediana = (v: number[]) => { const o = [...v].sort((a, b) => a - b); return o[o.length >> 1]; };

function nivelPerto(esp: ArrayLike<number>, bin: number): number {
  if (bin < 2 || bin + 2 >= esp.length) return -Infinity;
  let m = -Infinity;
  for (let k = bin - 2; k <= bin + 2; k++) if (esp[k] > m) m = esp[k];
  return m;
}

/** Picos estreitos do espectro (dB) que passam no teste do excesso e no do isolamento, do mais forte para o mais fraco (até 3). */
export function acharPicos(esp: ArrayLike<number>, o: OpcoesDetector): Pico[] {
  const binHz = o.sampleRate / o.fftSize;
  const kmin = Math.max(VIZ_LONGE + 1, Math.ceil((o.minHz ?? 250) / binHz));
  const kmax = Math.min(esp.length - VIZ_LONGE - 1, Math.floor((o.maxHz ?? 8000) / binHz));
  const acima = o.acimaDb ?? 16;
  const piso = o.nivelMinDb ?? -75;
  const achados: Pico[] = [];
  for (let k = kmin; k <= kmax; k++) {
    const s = esp[k];
    if (!(s >= piso) || s < esp[k - 1] || s < esp[k + 1] || s < esp[k - 2] || s < esp[k + 2]) continue;
    const viz: number[] = [];
    for (let d = VIZ_PERTO; d <= VIZ_LONGE; d++) { viz.push(esp[k - d]); viz.push(esp[k + d]); }
    const med = mediana(viz);
    const excesso = s - med;
    if (excesso < acima) continue;
    // Isolamento: um retorno é uma senoide sozinha; voz e instrumentos trazem a família harmônica. O triplo não entra: o apito que satura
    // (limitador, caixa de notebook distorcendo) cria harmônicos ímpares e não pode deixar de ser reconhecido por isso. Abaixo de 1 kHz (onde
    // fica a fundamental da voz e quase não há apito em caixa pequena) o triplo continua contando.
    const fam = k * binHz < 1000 ? [2 * k, 3 * k, Math.round(k / 2), Math.round(k / 3)] : [2 * k, Math.round(k / 2), Math.round(k / 3)];
    const familia = fam.some((b) => b >= 2 && b < esp.length - 2 && nivelPerto(esp, b) >= s - HARMONICO_DB);
    if (familia) continue;
    // Pente de harmônicos: outro pico forte (a mais de 15 dB da mediana e a menos de 12 dB deste) por perto, a uma distância de nota. Ruído não chega a tanto.
    let pente = false;
    for (let d = PENTE_MIN; d <= PENTE_MAX && !pente; d++) {
      for (const j of [k - d, k + d]) {
        if (j < 2 || j >= esp.length - 1) continue;
        if (esp[j] >= esp[j - 1] && esp[j] >= esp[j + 1] && esp[j] >= s - PENTE_DB && esp[j] >= med + PENTE_EXCESSO_DB) { pente = true; break; }
      }
    }
    if (pente) continue;
    // Frequência refinada pela parábola dos três bins do topo.
    const a = esp[k - 1]; const c = esp[k + 1];
    const den = a - 2 * s + c;
    const delta = den < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / den)) : 0;
    achados.push({ bin: k, hz: (k + delta) * binHz, nivelDb: s, excessoDb: excesso });
  }
  return achados.sort((x, y) => y.excessoDb - x.excessoDb).slice(0, 3);
}

type Trilha = { bin: number; desde: number; visto: number; nivelIni: number; nivel: number; binMin: number; binMax: number; avisadoEm: number; excesso: number };

/** Acompanha os picos quadro a quadro (~30 por segundo) e avisa quando um fica parado e persiste ou cresce. */
export class DetectorMicrofonia {
  private trilhas: Trilha[] = [];
  private readonly o: Required<OpcoesDetector>;

  constructor(opcoes: OpcoesDetector) {
    this.o = {
      minHz: 250, maxHz: 8000, acimaDb: 16, persisteMs: 180, cresceMs: 80, cresceDb: 4, nivelMinDb: -75, avisoCadaMs: 400, ...opcoes,
    };
  }

  reiniciar() { this.trilhas = []; }

  /** esp: espectro em dB (frequencyBinCount valores). tMs: instante do quadro. */
  analisar(esp: ArrayLike<number>, tMs: number): Deteccao | null {
    const picos = acharPicos(esp, this.o);
    const vistas = new Set<Trilha>();
    for (const p of picos) {
      let t = this.trilhas.find((x) => Math.abs(x.bin - p.bin) <= 1 && tMs - x.visto <= 100 && !vistas.has(x));
      if (!t) {
        t = { bin: p.bin, desde: tMs, visto: tMs, nivelIni: p.nivelDb, nivel: p.nivelDb, binMin: p.bin, binMax: p.bin, avisadoEm: -Infinity, excesso: p.excessoDb };
        this.trilhas.push(t);
      } else {
        t.visto = tMs; t.bin = p.bin; t.nivel = p.nivelDb; t.excesso = p.excessoDb;
        t.binMin = Math.min(t.binMin, p.bin); t.binMax = Math.max(t.binMax, p.bin);
        // Anda de frequência (vibrato, glissando): não é retorno. Recomeça a contar.
        if (t.binMax - t.binMin > 2) { t.desde = tMs; t.nivelIni = p.nivelDb; t.binMin = p.bin; t.binMax = p.bin; t.avisadoEm = -Infinity; }
      }
      vistas.add(t);
    }
    this.trilhas = this.trilhas.filter((x) => tMs - x.visto <= 100);
    const binHz = this.o.sampleRate / this.o.fftSize;
    let melhor: Deteccao | null = null;
    for (const t of this.trilhas) {
      if (!vistas.has(t) || tMs - t.avisadoEm < this.o.avisoCadaMs) continue;
      const dur = tMs - t.desde;
      const cresceu = t.nivel - t.nivelIni >= this.o.cresceDb;
      if (!(dur >= this.o.persisteMs || (dur >= this.o.cresceMs && cresceu))) continue;
      const pico = picos.find((p) => Math.abs(p.bin - t.bin) <= 1);
      const d: Deteccao = { hz: pico?.hz ?? t.bin * binHz, bin: t.bin, nivelDb: t.nivel, excessoDb: t.excesso, cresceu, duracaoMs: dur };
      if (!melhor || d.excessoDb > melhor.excessoDb) melhor = d;
    }
    if (melhor) {
      const alvo = this.trilhas.find((x) => x.bin === melhor!.bin);
      if (alvo) alvo.avisadoEm = tMs;
    }
    return melhor;
  }
}

// ---------- Cortes (filtros notch) e redução de ganho ----------

/** ultimo: última detecção nessa frequência. fixo: veio da afinação (não se solta sozinho). ganhoDb 0 = vaga livre. */
export type Corte = { hz: number; ganhoDb: number; criadoEm: number; ultimo: number; fixo: boolean; soltoEm: number };
export type Acao =
  | { tipo: 'cortar'; indice: number; hz: number; q: number; ganhoDb: number }
  | { tipo: 'abaixar'; db: number; totalDb: number };

export const MAX_CORTES = 8;
export const Q_CORTE = 30;
/** Profundidade de cada corte: começa em -18 dB e aprofunda a cada nova detecção na mesma frequência. */
export const PROFUNDIDADES_DB = [-18, -30, -40];
const MESMA_FREQ_HZ = 30;
const SATURADO_MS = 600;
/** Apito já alto (dB como o AnalyserNode): além do corte, baixa a voz na hora. */
export const EMERGENCIA_DB = -28;
const SOLTA_MS = 1500;
const PASSO_ABAIXAR_DB = 6;
const MAX_ABAIXAR_DB = 24;
/** Corte sem apito há 60 s começa a se soltar: 3 dB a cada 10 s até sumir (o som volta ao natural). */
export const SOLTAR_APOS_MS = 60000;
const SOLTAR_CADA_MS = 10000;
const SOLTAR_PASSO_DB = 3;
/** A redução de volume volta 3 dB a cada 30 s sem apito. */
const VOLTAR_VOLUME_MS = 30000;

/** Decide o que fazer com cada detecção: abre um corte (até 8, reaproveitando o mais antigo), aprofunda, ou abaixa a voz se não adiantar. */
export class GerenciadorMicrofonia {
  private cortes: Corte[] = [];
  private reducaoDb = 0;
  private saturadoDesde = -1;
  private ultimaDeteccao = -Infinity;
  private voltouEm = -Infinity;

  reiniciar() { this.cortes = []; this.reducaoDb = 0; this.saturadoDesde = -1; this.ultimaDeteccao = -Infinity; this.voltouEm = -Infinity; }

  /** Cortes ativos (as vagas livres, com ganho 0, ficam de fora). */
  estado() { return { cortes: this.cortes.filter((c) => c.ganhoDb < 0).map((c) => ({ ...c })), reducaoDb: this.reducaoDb }; }

  /** Marca os cortes atuais como fixos (resultado da afinação): não se soltam com o tempo. */
  fixarCortes() { for (const c of this.cortes) if (c.ganhoDb < 0) c.fixo = true; }

  /**
   * Chamar de tempos em tempos (1x por segundo basta): solta aos poucos os cortes que não apitam há 60 s e devolve o volume reduzido.
   * Ações 'cortar' com ganho maior (menos fundo) e 'abaixar' com db negativo (volume voltando).
   */
  soltar(tMs: number): Acao[] {
    const acoes: Acao[] = [];
    this.cortes.forEach((c, indice) => {
      if (c.fixo || c.ganhoDb >= 0 || tMs - c.ultimo < SOLTAR_APOS_MS || tMs - c.soltoEm < SOLTAR_CADA_MS) return;
      c.ganhoDb = Math.min(0, c.ganhoDb + SOLTAR_PASSO_DB);
      c.soltoEm = tMs;
      acoes.push({ tipo: 'cortar', indice, hz: c.hz, q: Q_CORTE, ganhoDb: c.ganhoDb });
    });
    if (this.reducaoDb > 0 && tMs - this.ultimaDeteccao >= VOLTAR_VOLUME_MS && tMs - this.voltouEm >= VOLTAR_VOLUME_MS) {
      const passo = Math.min(3, this.reducaoDb);
      this.reducaoDb -= passo;
      this.voltouEm = tMs;
      acoes.push({ tipo: 'abaixar', db: -passo, totalDb: this.reducaoDb });
    }
    return acoes;
  }

  /** Tira a redução de volume e mantém os cortes (fim da afinação). */
  zerarReducao() { this.reducaoDb = 0; this.saturadoDesde = -1; }

  aoDetectar(d: Pick<Deteccao, 'hz'> & { nivelDb?: number }, tMs: number): Acao[] {
    const acoes: Acao[] = [];
    if (d.nivelDb !== undefined && d.nivelDb >= EMERGENCIA_DB && this.reducaoDb < MAX_ABAIXAR_DB) {
      this.reducaoDb += PASSO_ABAIXAR_DB;
      acoes.push({ tipo: 'abaixar', db: PASSO_ABAIXAR_DB, totalDb: this.reducaoDb });
    }
    if (tMs - this.ultimaDeteccao > SOLTA_MS) this.saturadoDesde = -1;
    this.ultimaDeteccao = tMs;

    let maxado = false;
    const existente = this.cortes.findIndex((c) => Math.abs(c.hz - d.hz) <= MESMA_FREQ_HZ);
    if (existente >= 0) {
      const c = this.cortes[existente];
      c.ultimo = tMs;
      const nivel = PROFUNDIDADES_DB.indexOf(c.ganhoDb); // -1 (solto pela metade ou vaga livre): reabre no primeiro nível
      if (nivel < PROFUNDIDADES_DB.length - 1) {
        c.ganhoDb = PROFUNDIDADES_DB[nivel + 1];
        acoes.push({ tipo: 'cortar', indice: existente, hz: c.hz, q: Q_CORTE, ganhoDb: c.ganhoDb });
      } else maxado = true;
    } else {
      const novo: Corte = { hz: d.hz, ganhoDb: PROFUNDIDADES_DB[0], criadoEm: tMs, ultimo: tMs, fixo: false, soltoEm: -Infinity };
      let indice = this.cortes.findIndex((c) => c.ganhoDb >= 0);
      if (indice >= 0) this.cortes[indice] = novo;
      else if (this.cortes.length < MAX_CORTES) { indice = this.cortes.length; this.cortes.push(novo); }
      else {
        // Tudo ocupado: reaproveita o mais antigo que não é fixo (se todos forem fixos, o mais antigo).
        const candidatos = this.cortes.some((c) => !c.fixo) ? this.cortes.filter((c) => !c.fixo) : this.cortes;
        const maisAntigo = candidatos.reduce((m, c) => (c.criadoEm < m.criadoEm ? c : m));
        indice = this.cortes.indexOf(maisAntigo);
        this.cortes[indice] = novo;
      }
      acoes.push({ tipo: 'cortar', indice, hz: d.hz, q: Q_CORTE, ganhoDb: PROFUNDIDADES_DB[0] });
    }

    // Retorno que continua por mais de 1 s sem recurso (os 8 cortes ocupados, ou o corte dessa frequência já no máximo): baixa a voz.
    if (this.cortes.filter((c) => c.ganhoDb < 0).length >= MAX_CORTES || maxado) {
      if (this.saturadoDesde < 0) this.saturadoDesde = tMs;
      else if (tMs - this.saturadoDesde > SATURADO_MS && this.reducaoDb < MAX_ABAIXAR_DB) {
        this.reducaoDb += PASSO_ABAIXAR_DB;
        this.saturadoDesde = tMs;
        acoes.push({ tipo: 'abaixar', db: PASSO_ABAIXAR_DB, totalDb: this.reducaoDb });
      }
    }
    return acoes;
  }
}
