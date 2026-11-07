// Cálculo da nota do karaokê. Funções puras, sem imports: testadas por pontuacao.test.mjs.
// Sem notas de referência, a nota mede quanto a pessoa cantou, quão firme e afinada foi a voz e a energia.

/** Um instante medido do microfone. t em ms desde o início da gravação; hz 0 = sem altura clara. m = posição do vídeo (ms) nesse instante, se conhecida. */
export type Quadro = { t: number; hz: number; clareza: number; rms: number; m?: number };

/** Trecho (ms da posição do vídeo) em que a letra está sendo cantada. */
export type Janela = { de: number; ate: number };

export type Detalhes = {
  cobertura: number; // fração da música com voz detectada (0 a 1)
  afinacao: number; // 0 a 1: proximidade média do semitom mais próximo
  estabilidade: number; // 0 a 1: pouca oscilação dentro de cada trecho sustentado
  energia: number; // 0 a 1: volume da voz acima do ruído
  trechos: number;
  ruido: number;
  limiar: number;
  /** 'letra': nota só dentro das linhas da letra; ausente ou 'video': música inteira; 'estudio': nota contra as notas da melodia. */
  modo?: 'letra' | 'video' | 'estudio';
  /** Só no modo estúdio: pontos das notas + bônus das linhas (0 a 10000) e a parte do bônus. */
  total?: number;
  bonus?: number;
  /** Só no modo estúdio: pontos do bônus de sequência, maior multiplicador, maior sequência de notas e notas perfeitas. */
  comboPontos?: number;
  maiorCombo?: number;
  maiorSequencia?: number;
  perfeitas?: number;
  /** Só no modo estúdio: pontos extras que o Modo Estrela deu às notas (ausente se não foi usado). */
  estrelaPontos?: number;
};

export type Resultado = { nota: number; estrelas: number; detalhes: Detalhes };

export const CLAREZA_MINIMA = 0.8;
export const HZ_MIN = 70;
export const HZ_MAX = 1200;
const RUIDO_MS = 2000;
const PISO_RMS = 0.01;
/** Nenhum quadro conta por mais que isso: pausas e travadas não viram "tempo cantando". */
const DT_MAX_MS = 100;
/** Tempo de voz que já vale cobertura total (ninguém canta 100% do vídeo: tem introdução e solos). */
const COBERTURA_CHEIA = 0.55;
const PISO_NOTA = 40;
/** Com a letra, a cobertura é medida só nas linhas cantadas (sem introdução nem solos), então o "cantou o bastante" é maior. */
const COBERTURA_CHEIA_LETRA = 0.7;
/** Folga em volta de cada linha da letra (entra no tempo de letra): quem começa um pouco antes ou termina um pouco depois ainda é contado. */
const FOLGA_JANELA_MS = 250;

const limitar = (x: number, min = 0, max = 1) => (x < min ? min : x > max ? max : x);

export function hzParaMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

const NOMES = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si'];
export function nomeDaNota(midi: number): string {
  const n = Math.round(midi);
  return NOMES[((n % 12) + 12) % 12];
}

/** Distância em cents até o semitom mais próximo (0 a 50). */
export function desvioCents(midi: number): number {
  return Math.abs(midi - Math.round(midi)) * 100;
}

function percentil(valores: number[], p: number): number {
  if (!valores.length) return 0;
  const o = [...valores].sort((a, b) => a - b);
  return o[Math.min(o.length - 1, Math.floor(p * o.length))];
}

/** Ruído do ambiente: percentil 90 do volume nos 2 s iniciais da gravação. */
export function medirRuido(quadros: readonly Quadro[]): number {
  if (!quadros.length) return 0;
  const t0 = quadros[0].t;
  return percentil(quadros.filter((q) => q.t - t0 < RUIDO_MS).map((q) => q.rms), 0.9);
}

export function limiarDeVoz(ruido: number): number {
  return Math.max(PISO_RMS, ruido * 2);
}

export function cantando(q: Quadro, limiar: number): boolean {
  return q.clareza > CLAREZA_MINIMA && q.rms > limiar && q.hz >= HZ_MIN && q.hz <= HZ_MAX;
}

export function estrelasDaNota(nota: number): number {
  if (nota >= 88) return 5;
  if (nota >= 74) return 4;
  if (nota >= 60) return 3;
  if (nota >= 45) return 2;
  return 1;
}

/**
 * Calcula a nota de uma apresentação.
 * quadros: série medida durante a música; duracaoMs: duração do vídeo.
 * inicioMs: instante (mesma escala de t) em que a música começou; o ruído usa os 2 s antes dele
 * (a contagem regressiva), e só quadros depois dele valem nota. Sem inicioMs, tudo vale e o ruído sai dos 2 s iniciais.
 * janelas (opcional): trechos da letra, na mesma escala de Quadro.m. Com elas, só contam os quadros dentro das linhas com texto
 * e a cobertura é medida sobre o tempo dessas linhas: silêncio durante a letra pesa um pouco, pausas instrumentais não pesam nada.
 * Sem janelas, ou se nenhum quadro traz m, vale a música inteira.
 */
export function pontuar(quadros: readonly Quadro[], duracaoMs: number, inicioMs?: number, janelas?: readonly Janela[]): Resultado {
  const todos = [...quadros].sort((a, b) => a.t - b.t);
  const ruidoBase = inicioMs === undefined ? todos : todos.filter((q) => q.t < inicioMs);
  const ruido = medirRuido(ruidoBase.length ? ruidoBase : todos);
  const limiar = limiarDeVoz(ruido);
  let q = inicioMs === undefined ? todos : todos.filter((x) => x.t >= inicioMs);

  // Letra: recorta as janelas ao que tocou e fica só com os quadros dentro delas.
  const fimMs = Math.max(0, duracaoMs);
  const recortadas = (janelas ?? [])
    .map((j) => ({ de: Math.max(0, j.de), ate: Math.min(fimMs, j.ate) }))
    .filter((j) => Number.isFinite(j.de) && Number.isFinite(j.ate) && j.ate > j.de)
    .map((j) => ({ de: j.de - FOLGA_JANELA_MS, ate: j.ate + FOLGA_JANELA_MS }))
    .sort((a, b) => a.de - b.de);
  // Junta janelas que se encostam (com a folga) para o tempo de letra não ser contado em dobro.
  const validas: Janela[] = [];
  for (const j of recortadas) {
    const ultima = validas[validas.length - 1];
    if (ultima && j.de <= ultima.ate) ultima.ate = Math.max(ultima.ate, j.ate);
    else validas.push({ ...j });
  }
  const porLetra = validas.length > 0 && q.some((x) => typeof x.m === 'number');
  const tempoLetra = porLetra ? validas.reduce((a, j) => a + (j.ate - j.de), 0) : 0;
  if (porLetra) q = q.filter((x) => typeof x.m === 'number' && validas.some((j) => x.m! >= j.de && x.m! < j.ate));

  let tempoVoz = 0;
  let somaRms = 0;
  let nVoz = 0;
  let somaDesvio = 0; // em cents, ponderado por quadro
  let somaDp = 0; // desvio padrão (semitons) ponderado pelo tamanho do trecho
  let quadrosTrecho = 0;
  let trechos = 0;

  // Quebra em trechos sustentados: voz contínua sem salto maior que ~1 semitom entre quadros vizinhos.
  let atual: number[] = [];
  const fechar = () => {
    if (atual.length >= 5) {
      const media = atual.reduce((a, b) => a + b, 0) / atual.length;
      const dp = Math.sqrt(atual.reduce((a, m) => a + (m - media) ** 2, 0) / atual.length);
      somaDp += dp * atual.length;
      for (const m of atual) somaDesvio += desvioCents(m);
      quadrosTrecho += atual.length;
      trechos++;
    }
    atual = [];
  };
  let ultimoT = -Infinity;
  for (let i = 0; i < q.length; i++) {
    const f = q[i];
    if (!cantando(f, limiar)) {
      if (f.t - ultimoT > 150) fechar();
      continue;
    }
    const proximo = i + 1 < q.length ? q[i + 1].t : f.t + 33;
    tempoVoz += Math.min(DT_MAX_MS, Math.max(0, proximo - f.t));
    somaRms += f.rms;
    nVoz++;
    const midi = hzParaMidi(f.hz);
    if (atual.length && (f.t - ultimoT > 150 || Math.abs(midi - atual[atual.length - 1]) > 1)) fechar();
    atual.push(midi);
    ultimoT = f.t;
  }
  fechar();

  const dur = Math.max(1, porLetra ? tempoLetra : duracaoMs);
  const cobertura = limitar(tempoVoz / dur);
  const coberturaNorm = limitar(cobertura / (porLetra ? COBERTURA_CHEIA_LETRA : COBERTURA_CHEIA));
  // Sem trecho sustentado a pessoa falou ou sussurrou: afinação neutra baixa, não zero.
  const afinacao = quadrosTrecho ? limitar(1 - somaDesvio / quadrosTrecho / 50) : nVoz ? 0.4 : 0;
  const estabilidade = quadrosTrecho ? limitar(1 - somaDp / quadrosTrecho / 0.8) : nVoz ? 0.4 : 0;
  const energia = nVoz ? limitar(0.4 + 0.6 * limitar((somaRms / nVoz / limiar - 1) / 3)) : 0;

  const bruto = 0.45 * coberturaNorm + 0.3 * afinacao + 0.1 * estabilidade + 0.15 * energia;
  // Cantou boa parte da música: piso de 40. Quem mal abriu a boca não ganha o piso.
  const piso = PISO_NOTA * limitar(cobertura / 0.3);
  const nota = Math.round(limitar(piso + (100 - piso) * Math.pow(bruto, 1.5), 0, 100));
  const arred = (x: number) => Math.round(x * 1000) / 1000;
  return {
    nota,
    estrelas: estrelasDaNota(nota),
    detalhes: { cobertura: arred(cobertura), afinacao: arred(afinacao), estabilidade: arred(estabilidade), energia: arred(energia), trechos, ruido: arred(ruido), limiar: arred(limiar), modo: porLetra ? 'letra' : 'video' },
  };
}

// ---------- Modo estúdio (estilo Performous): nota contra as notas reais da melodia ----------

/** Nota da melodia. Tempos em ms da música (relógio da letra, já sem o ajuste de sincronia). */
export type NotaEstudio = { inicio_ms: number; dur_ms: number; midi: number; golden: boolean; linha: number };

/** linhas: perfeição (0 a 1) de cada linha com notas, na ordem do número da linha. */
export type ResumoEstudio = { maiorCombo: number; maiorSequencia: number; perfeitas: number; notas: number; perfeitasPct: number; pontos: number };
export type ResultadoEstudio = Resultado & { total: number; linhas: number[]; resumo: ResumoEstudio };

export const LATENCIA_PADRAO_MS = 80;
export const LATENCIA_MAX_MS = 400;
/** Até esse erro (semitons) vale ponto cheio; de 0,5 até 1,5 cai linearmente a zero (modo Fácil). */
const ERRO_CHEIO = 0.5;
const ERRO_ZERO = 1.5;
const PONTOS_NOTAS = 9000;
const PONTOS_LINHAS = 1000;
const MULT_GOLDEN = 2;

/** Erro em semitons com a oitava ignorada: 0 a 6. */
export function erroEmSemitons(p: number, n: number): number {
  const r = (((p - n + 6) % 12) + 12) % 12;
  return Math.abs(r - 6);
}

/** Fração do ponto (0 a 1) para um erro em semitons. */
export function fatorDeAcerto(erro: number, cheio: number = ERRO_CHEIO, zero: number = ERRO_ZERO): number {
  return limitar((zero - erro) / (zero - cheio));
}

/** Índice da nota que cobre o instante t (notas ordenadas por início), ou -1. */
export function notaEm(notas: readonly NotaEstudio[], t: number): number {
  let lo = 0;
  let hi = notas.length - 1;
  let achado = -1;
  while (lo <= hi) {
    const meio = (lo + hi) >> 1;
    if (notas[meio].inicio_ms <= t) { achado = meio; lo = meio + 1; } else hi = meio - 1;
  }
  for (let i = achado; i >= 0 && i >= achado - 2; i--) if (t < notas[i].inicio_ms + notas[i].dur_ms) return i;
  return -1;
}

export const multiplicadorDaNota = (n: Pick<NotaEstudio, 'golden'>) => (n.golden ? MULT_GOLDEN : 1);

export function estrelasEstudio(nota: number): number {
  if (nota >= 85) return 5;
  if (nota >= 70) return 4;
  if (nota >= 55) return 3;
  if (nota >= 35) return 2;
  return 1;
}

/** Notas válidas, ordenadas por início. */
export function prepararNotas(notas: readonly NotaEstudio[] | null | undefined): NotaEstudio[] {
  if (!Array.isArray(notas)) return [];
  return notas
    .filter((n) => Boolean(n) && Number.isFinite(n.inicio_ms) && Number.isFinite(n.dur_ms) && n.dur_ms > 0 && Number.isFinite(n.midi))
    .map((n) => ({ inicio_ms: n.inicio_ms, dur_ms: n.dur_ms, midi: n.midi, golden: Boolean(n.golden), linha: Number.isFinite(n.linha) ? n.linha : 0 }))
    .sort((a, b) => a.inicio_ms - b.inicio_ms);
}

/** Nota acertada (conta para a sequência) a partir desta fração de acerto; perfeita a partir de PERFEITA. */
export const RAZAO_ACERTO = 0.6;
export const RAZAO_PERFEITA = 0.9;
export const RAZAO_ESTRELA = 0.8;
/** Bônus máximo da sequência: 15% dos 10000 pontos possíveis. */
export const BONUS_SEQUENCIA_MAX = 1500;
export const PONTOS_MAX = 10000;
/**
 * Clareza mínima do tom no modo estúdio. Voz cantada real fica quase toda entre 0,5 e 0,95 no pitchy (p10 = 0,65 na voz original separada);
 * com 0,8 só ~65% dos quadros dentro das notas valiam. A conferência de altura (erro em semitons) é que separa voz de ruído.
 */
export const CLAREZA_ESTUDIO = 0.5;
/**
 * Fração de cada nota que a voz original separada cobre com tom certo: as notas vêm de palavras alinhadas (palavra inteira), e consoantes,
 * respiração, bordas e vibrato largo ficam sem altura ou fora do semitom (medido em 3 músicas: 69 a 77% dos quadros dentro das notas têm tom
 * válido e 58 a 67% deles ficam a 0,5 semitom ou menos). O acerto da nota é medido contra essa fração:
 * acumulado / (peso * COBERTURA_ESPERADA), limitado a 1.
 */
export const COBERTURA_ESPERADA = 0.5;
/** Tolerância de tempo: a voz vale numa nota até esta folga antes e depois dela (as notas vêm de palavras alinhadas, com erro de ~100 ms). */
export const GRACA_ESTUDIO_MS = 100;
/** Anti tom fixo: nos últimos DRONE_QUADROS quadros com voz, se a altura cantada quase não mexeu e a melodia mexeu, o acerto vale pouco. */
const DRONE_QUADROS = 30;
const DRONE_VOZ_MAX = 0.7;
const DRONE_MELODIA_MIN = 1.5;
const DRONE_FATOR = 0.1;
const dobrar12 = (x: number) => ((((x + 6) % 12) + 12) % 12) - 6;
/** Notas mais curtas que isso (sílabas rápidas) valem pontos, mas não aumentam nem quebram a sequência. */
export const NOTA_MIN_SEQUENCIA_MS = 150;
/** Ruído do ambiente no estúdio: limiar = 2 x ruído, entre 0,008 e 0,03 (a música da própria TV vaza para o microfone e não pode calar a voz). */
export function limiarDeVozEstudio(ruido: number): number {
  return limitar(ruido * 2, 0.008, 0.03);
}

/** Modo Estrela: os pontos das notas valem x2 durante 8 s. */
export const ESTRELA_MULT = 2;
export const ESTRELA_DURACAO_MS = 8000;

/** Multiplicador da sequência: x1, x2 (5 notas seguidas), x3 (10) e x4 (20). */
export function multiplicadorDeCombo(sequencia: number): number {
  return sequencia >= 20 ? 4 : sequencia >= 10 ? 3 : sequencia >= 5 ? 2 : 1;
}

export type EventoAoVivo =
  | { tipo: 'nota'; indice: number; razao: number; golden: boolean; combo: number; sequencia: number; quebrou: boolean }
  | { tipo: 'estrela'; indice: number }
  | { tipo: 'linha'; linha: number; perfeicao: number; pontos: number };

export type EstadoAoVivo = {
  /** 0 a 10000 (já limitado). */
  pontos: number;
  bruto: number;
  pontosNotas: number;
  pontosLinhas: number;
  pontosSequencia: number;
  /** Pontos extras das notas dados pelo Modo Estrela (já somados em pontosNotas). */
  pontosEstrela: number;
  /** Nota 0 a 100 equivalente. */
  nota: number;
  combo: number;
  sequencia: number;
  maiorSequencia: number;
  maiorCombo: number;
  notasFinalizadas: number;
  notasTotal: number;
  notasPerfeitas: number;
  perfeitasPct: number;
  quadrosValidos: number;
};

export type OpcoesMotor = { latenciaMs?: number; offsetMs?: number; limiar?: number; clarezaMinima?: number; cobertura?: number; erroCheio?: number; erroZero?: number; gracaMs?: number };

const SEM_EVENTOS: readonly EventoAoVivo[] = Object.freeze([]);

/**
 * Pontuação estilo Performous, incremental. Uma única fórmula para o placar ao vivo e para a nota final:
 * 9000 * acumulado / soma(multiplicador * duração)  (oitava ignorada, golden x2, fator 1 até 0,5 semitom e 0 a partir de 1,5)
 * + 1000 / nLinhas * perfeição de cada linha (somado quando a linha termina)
 * + bônus de sequência (até 1500): cada nota acertada (>= 60%) dentro de uma sequência x2, x3 ou x4 soma
 *   1500 * (peso da nota / peso total) * (multiplicador - 1) / 3 * acerto da nota. Errar uma nota volta a x1.
 * Pontos = soma limitada a 10000; nota = pontos / 100.
 * adicionarQuadro recebe ms (posição do áudio), midi (null se sem altura), clareza e volume; o limiar de voz vem de definirLimiar.
 * Quando ms passa do fim de uma nota, ela é fechada (sequência, linha). encerrar() fecha o que faltar.
 */
export class PontuacaoAoVivo {
  private readonly notas: NotaEstudio[];
  private readonly peso: number[];
  private readonly maximo: number;
  private readonly ganho: number[];
  private readonly fechada: boolean[];
  private readonly estrelada: boolean[];
  private readonly linhaRestam = new Map<number, number>();
  private readonly linhaPeso = new Map<number, number>();
  private readonly linhaGanho = new Map<number, number>();
  private readonly linhaPerfeicao = new Map<number, number>();
  private readonly nLinhas: number;
  private latenciaMs: number;
  private offsetMs: number;
  private limiar: number;
  private readonly clarezaMinima: number;
  private readonly cobertura: number;
  private readonly erroCheio: number;
  private readonly erroZero: number;
  private readonly gracaMs: number;
  private readonly droneVoz = new Float64Array(DRONE_QUADROS);
  private readonly droneRef = new Float64Array(DRONE_QUADROS);
  private droneN = 0;
  private droneI = 0;
  private proximo = 0;
  private somaGanho = 0;
  /** Modo Estrela: janelas (ms da posição do áudio) com multiplicador explícito e o ganho extra acumulado (ganho * (mult - 1)). */
  private readonly janelasEstrela: { de: number; ate: number; mult: number }[] = [];
  private extraEstrela = 0;
  private pontosLinhas = 0;
  private pontosSequencia = 0;
  private sequencia = 0;
  private maiorSequencia = 0;
  private maiorCombo = 1;
  private perfeitas = 0;
  private fechadas = 0;
  private fechadasLongas = 0;
  private ultimoMs: number | null = null;
  private pontosNoCorte = 0;
  private tempoValido = 0;
  private somaFator = 0;
  private validos = 0;
  /** O que o último quadro encontrou: nota sob o tom (ou -1), fator de acerto, se tinha voz válida e o ms. */
  ultimoQuadro = { indice: -1, fator: 0, valido: false, ms: 0 };

  constructor(notas: readonly NotaEstudio[], opcoes: OpcoesMotor = {}) {
    this.notas = prepararNotas(notas);
    this.latenciaMs = opcoes.latenciaMs ?? LATENCIA_PADRAO_MS;
    this.offsetMs = opcoes.offsetMs ?? 0;
    this.limiar = opcoes.limiar ?? limiarDeVozEstudio(0);
    this.clarezaMinima = opcoes.clarezaMinima ?? CLAREZA_ESTUDIO;
    this.cobertura = limitar(opcoes.cobertura ?? COBERTURA_ESPERADA, 0.1, 1);
    this.erroCheio = opcoes.erroCheio ?? ERRO_CHEIO;
    this.erroZero = opcoes.erroZero ?? ERRO_ZERO;
    this.gracaMs = opcoes.gracaMs ?? GRACA_ESTUDIO_MS;
    this.peso = this.notas.map((n) => multiplicadorDaNota(n) * n.dur_ms);
    this.maximo = this.peso.reduce((a, b) => a + b, 0);
    this.ganho = this.notas.map(() => 0);
    this.fechada = this.notas.map(() => false);
    this.estrelada = this.notas.map(() => false);
    this.notas.forEach((n, i) => {
      this.linhaRestam.set(n.linha, (this.linhaRestam.get(n.linha) ?? 0) + 1);
      this.linhaPeso.set(n.linha, (this.linhaPeso.get(n.linha) ?? 0) + this.peso[i]);
    });
    this.nLinhas = this.linhaRestam.size;
  }

  definirLimiar(limiar: number) { this.limiar = limiar; }
  definirAjuste(latenciaMs: number, offsetMs: number) { this.latenciaMs = latenciaMs; this.offsetMs = offsetMs; }

  /**
   * Modo Estrela: de ms (posição do áudio, a mesma de adicionarQuadro) até ms + duracaoMs, o ganho de pontos das notas vale mult vezes.
   * Só os pontos das notas dobram (acerto, sequência e linhas não mudam); o limite final de 10000 continua valendo.
   */
  iniciarEstrela(ms: number, duracaoMs = ESTRELA_DURACAO_MS, mult = ESTRELA_MULT) {
    if (!Number.isFinite(ms) || !(duracaoMs > 0) || !(mult > 1)) return;
    this.janelasEstrela.push({ de: ms, ate: ms + duracaoMs, mult });
  }
  /** Multiplicador dos pontos das notas na posição ms (1 fora de qualquer janela; janelas não se acumulam, vale a maior). */
  multiplicadorEstrela(ms: number): number {
    let m = 1;
    for (const j of this.janelasEstrela) if (ms >= j.de && ms < j.ate && j.mult > m) m = j.mult;
    return m;
  }
  estrelaAtiva(ms: number): boolean { return this.multiplicadorEstrela(ms) > 1; }
  get notasPreparadas(): readonly NotaEstudio[] { return this.notas; }
  /** Pontos já ganhos pela nota i, com a cobertura esperada (uma voz perfeita enche a nota com 70% do tempo em tom). */
  private efetivo(i: number): number { return Math.min(this.peso[i], this.ganho[i] / this.cobertura); }
  /** Fração de acerto (0 a 1) da nota i até agora. */
  razaoDaNota(i: number): number { return this.peso[i] > 0 ? limitar(this.efetivo(i) / this.peso[i]) : 0; }

  adicionarQuadro(ms: number, midi: number | null, clareza: number, volume: number, dtMs?: number): readonly EventoAoVivo[] {
    if (!Number.isFinite(ms)) return SEM_EVENTOS;
    const eventos: EventoAoVivo[] = [];
    const dt = dtMs ?? (this.ultimoMs === null ? 33 : limitar(ms - this.ultimoMs, 0, DT_MAX_MS));
    this.ultimoMs = ms;
    const tn = ms - this.offsetMs - this.latenciaMs;
    while (this.proximo < this.notas.length && this.notas[this.proximo].inicio_ms + this.notas[this.proximo].dur_ms + this.gracaMs <= tn) this.fechar(this.proximo++, eventos);
    const valido = midi !== null && Number.isFinite(midi) && clareza >= this.clarezaMinima && volume > this.limiar;
    // Nota sob o tom: a que cobre tn; com tolerância de tempo (graça), entre as vizinhas vale a de altura mais próxima.
    let indice = -1;
    let fator = 0;
    let melhor = -1;
    for (let j = this.proximo; j < this.notas.length; j++) {
      const n = this.notas[j];
      if (n.inicio_ms - this.gracaMs > tn) break;
      if (this.fechada[j] || tn >= n.inicio_ms + n.dur_ms + this.gracaMs) continue;
      const dentro = tn >= n.inicio_ms && tn < n.inicio_ms + n.dur_ms;
      const fj = valido ? fatorDeAcerto(erroEmSemitons(midi as number, n.midi), this.erroCheio, this.erroZero) : 0;
      // prefere maior acerto; empate: a que contém tn
      if (indice < 0 || fj > melhor || (fj === melhor && dentro && !(tn >= this.notas[indice].inicio_ms && tn < this.notas[indice].inicio_ms + this.notas[indice].dur_ms))) { indice = j; melhor = fj; fator = fj; }
    }
    if (valido && indice >= 0 && fator > 0 && this.ehTomFixo(midi as number, this.notas[indice].midi)) fator *= DRONE_FATOR;
    if (valido && indice >= 0 && fator > 0) {
      const n = this.notas[indice];
      const antes = this.efetivo(indice);
      this.ganho[indice] = Math.min(this.peso[indice], this.ganho[indice] + multiplicadorDaNota(n) * fator * dt);
      const delta = this.efetivo(indice) - antes;
      this.somaGanho += delta;
      const mEstrela = this.multiplicadorEstrela(ms);
      if (mEstrela > 1) this.extraEstrela += delta * (mEstrela - 1);
      this.tempoValido += dt;
      this.somaFator += fator * dt;
      this.validos++;
      if (!this.estrelada[indice] && this.razaoDaNota(indice) >= RAZAO_ESTRELA) { this.estrelada[indice] = true; eventos.push({ tipo: 'estrela', indice }); }
    } else if (valido && indice >= 0) {
      this.tempoValido += dt;
      this.validos++;
    }
    this.ultimoQuadro = { indice, fator, valido, ms };
    return eventos.length ? eventos : SEM_EVENTOS;
  }

  /** Registra o quadro e diz se a voz está parada num tom enquanto a melodia anda (tom fixo, assobio ou tecla presa). */
  private ehTomFixo(voz: number, ref: number): boolean {
    this.droneVoz[this.droneI] = voz;
    this.droneRef[this.droneI] = ref;
    this.droneI = (this.droneI + 1) % DRONE_QUADROS;
    this.droneN = Math.min(DRONE_QUADROS, this.droneN + 1);
    if (this.droneN < DRONE_QUADROS) return false;
    let vMin = 0; let vMax = 0; let rMin = 0; let rMax = 0;
    for (let k = 0; k < DRONE_QUADROS; k++) {
      const dv = dobrar12(this.droneVoz[k] - voz);
      const dr = dobrar12(this.droneRef[k] - ref);
      if (dv < vMin) vMin = dv; if (dv > vMax) vMax = dv;
      if (dr < rMin) rMin = dr; if (dr > rMax) rMax = dr;
    }
    return vMax - vMin < DRONE_VOZ_MAX && rMax - rMin > DRONE_MELODIA_MIN;
  }

  private fechar(i: number, eventos: EventoAoVivo[]) {
    const n = this.notas[i];
    const razao = this.razaoDaNota(i);
    this.fechada[i] = true;
    this.fechadas++;
    if (n.dur_ms >= NOTA_MIN_SEQUENCIA_MS) this.fechadasLongas++;
    const comboAntes = multiplicadorDeCombo(this.sequencia);
    const acertou = razao >= RAZAO_ACERTO;
    const curta = n.dur_ms < NOTA_MIN_SEQUENCIA_MS;
    if (curta) {
      // sílaba rápida: vale pontos, mas não mexe na sequência
    } else if (acertou) {
      this.sequencia++;
      this.maiorSequencia = Math.max(this.maiorSequencia, this.sequencia);
      const m = multiplicadorDeCombo(this.sequencia);
      this.maiorCombo = Math.max(this.maiorCombo, m);
      if (this.maximo > 0) this.pontosSequencia += BONUS_SEQUENCIA_MAX * (this.peso[i] / this.maximo) * ((m - 1) / 3) * razao;
    } else this.sequencia = 0;
    if (razao >= RAZAO_PERFEITA && !curta) this.perfeitas++;
    eventos.push({ tipo: 'nota', indice: i, razao, golden: n.golden, combo: multiplicadorDeCombo(this.sequencia), sequencia: this.sequencia, quebrou: !curta && !acertou && comboAntes > 1 });
    this.linhaGanho.set(n.linha, (this.linhaGanho.get(n.linha) ?? 0) + this.efetivo(i));
    const restam = (this.linhaRestam.get(n.linha) ?? 1) - 1;
    this.linhaRestam.set(n.linha, restam);
    if (restam <= 0) {
      const peso = this.linhaPeso.get(n.linha) ?? 0;
      const perfeicao = peso > 0 ? limitar((this.linhaGanho.get(n.linha) ?? 0) / peso) : 0;
      this.linhaPerfeicao.set(n.linha, perfeicao);
      this.pontosLinhas += (PONTOS_LINHAS / this.nLinhas) * perfeicao;
      const bruto = this.bruto();
      eventos.push({ tipo: 'linha', linha: n.linha, perfeicao, pontos: Math.max(0, Math.round(bruto - this.pontosNoCorte)) });
      this.pontosNoCorte = bruto;
    }
  }

  private pontosNotas(): number { return this.maximo > 0 ? PONTOS_NOTAS * (limitar(this.somaGanho / this.maximo) + this.extraEstrela / this.maximo) : 0; }
  private pontosEstrela(): number { return this.maximo > 0 ? PONTOS_NOTAS * (this.extraEstrela / this.maximo) : 0; }
  private bruto(): number { return this.pontosNotas() + this.pontosLinhas + this.pontosSequencia; }

  /** Fecha as notas que faltam (fim da música). Devolve os eventos gerados. */
  encerrar(): readonly EventoAoVivo[] {
    const eventos: EventoAoVivo[] = [];
    while (this.proximo < this.notas.length) this.fechar(this.proximo++, eventos);
    return eventos;
  }

  estado(): EstadoAoVivo {
    const bruto = this.bruto();
    const pontos = Math.min(PONTOS_MAX, Math.round(bruto));
    return {
      pontos, bruto,
      pontosNotas: this.pontosNotas(), pontosLinhas: this.pontosLinhas, pontosSequencia: this.pontosSequencia, pontosEstrela: this.pontosEstrela(),
      nota: Math.round(limitar(pontos / 100, 0, 100)),
      combo: multiplicadorDeCombo(this.sequencia), sequencia: this.sequencia,
      maiorSequencia: this.maiorSequencia, maiorCombo: this.maiorCombo,
      notasFinalizadas: this.fechadas, notasTotal: this.notas.length, notasPerfeitas: this.perfeitas,
      perfeitasPct: this.fechadasLongas ? this.perfeitas / this.fechadasLongas : 0,
      quadrosValidos: this.validos,
    };
  }

  /** Fecha tudo e devolve o resultado final (a mesma conta do placar ao vivo). ruido: só para registrar nos detalhes. */
  resultado(ruido = 0): ResultadoEstudio {
    this.encerrar();
    const e = this.estado();
    const ordem = [...this.linhaPerfeicao.keys()].sort((a, b) => a - b);
    const linhas = ordem.map((k) => this.linhaPerfeicao.get(k) ?? 0);
    const duracaoNotas = this.notas.reduce((a, n) => a + n.dur_ms, 0);
    const arred = (x: number) => Math.round(x * 1000) / 1000;
    const total = Math.round(Math.min(PONTOS_MAX, e.bruto) * 10) / 10;
    return {
      nota: e.nota,
      estrelas: estrelasEstudio(e.nota),
      total,
      linhas: linhas.map(arred),
      resumo: { maiorCombo: e.maiorCombo, maiorSequencia: e.maiorSequencia, perfeitas: e.notasPerfeitas, notas: e.notasTotal, perfeitasPct: arred(e.perfeitasPct), pontos: e.pontos },
      detalhes: {
        cobertura: arred(duracaoNotas > 0 ? limitar(this.tempoValido / duracaoNotas) : 0),
        afinacao: arred(this.tempoValido > 0 ? this.somaFator / this.tempoValido : 0),
        estabilidade: 0,
        energia: 0,
        trechos: this.ganho.filter((g) => g > 0).length,
        ruido: arred(ruido),
        limiar: arred(this.limiar),
        modo: 'estudio',
        total,
        bonus: Math.round(this.pontosLinhas * 10) / 10,
        comboPontos: Math.round(this.pontosSequencia * 10) / 10,
        maiorCombo: e.maiorCombo,
        maiorSequencia: e.maiorSequencia,
        perfeitas: e.notasPerfeitas,
        ...(this.extraEstrela > 0 ? { estrelaPontos: Math.round(this.pontosEstrela() * 10) / 10 } : {}),
      },
    };
  }
}

/**
 * Nota estilo Performous em lote (a partir dos quadros gravados): usa a mesma PontuacaoAoVivo, então dá o mesmo resultado do placar ao vivo.
 * quadros precisam trazer m (posição do áudio em ms). latenciaMs: atraso entre ouvir e cantar (e do microfone), descontado de m.
 * offsetMs: ajuste de sincronia do telão (positivo atrasa a letra e as notas).
 */
export function pontuarEstudio(quadros: readonly Quadro[], notas: readonly NotaEstudio[], latenciaMs: number = LATENCIA_PADRAO_MS, offsetMs = 0, opcoes: OpcoesMotor = {}): ResultadoEstudio {
  const todos = [...quadros].sort((a, b) => a.t - b.t);
  const ruido = medirRuido(todos);
  const motor = new PontuacaoAoVivo(notas, { latenciaMs, offsetMs, limiar: limiarDeVozEstudio(ruido), ...opcoes });
  for (let i = 0; i < todos.length; i++) {
    const f = todos[i];
    if (typeof f.m !== 'number' || !Number.isFinite(f.m)) continue;
    const proximo = i + 1 < todos.length ? todos[i + 1].t : f.t + 33;
    const dt = Math.min(DT_MAX_MS, Math.max(0, proximo - f.t));
    motor.adicionarQuadro(f.m, f.hz >= HZ_MIN && f.hz <= HZ_MAX ? hzParaMidi(f.hz) : null, f.clareza, f.rms, dt);
  }
  return motor.resultado(ruido);
}

// ---------- Medidor de plateia (energia da festa) ----------

/** Energia da plateia de 0 a 1: sobe com acertos, cai com silêncio e erros. */
export class PlateiaEnergia {
  nivel: number;
  constructor(inicial = 0.5) { this.nivel = limitar(inicial); }
  reiniciar(inicial = 0.5) { this.nivel = limitar(inicial); }
  /** forca de -1 a 1: positiva sobe até 0,24 por segundo, negativa desce até 0,14 por segundo. */
  atualizar(dtMs: number, forca: number) {
    const f = limitar(forca, -1, 1);
    this.nivel = limitar(this.nivel + f * (f > 0 ? 0.24 : 0.14) * (Math.max(0, dtMs) / 1000));
  }
}

/** Força para a plateia no modo estúdio, a partir do último quadro da pontuação. */
export function forcaEstudio(q: { indice: number; fator: number; valido: boolean }): number {
  if (q.indice >= 0) return q.valido ? (q.fator > 0 ? q.fator : -0.7) : -0.8;
  return q.valido ? 0 : -0.15;
}

/** Força para a plateia no modo letra: voz durante uma linha da letra anima, silêncio durante a linha esfria. */
export function forcaLetra(dentroDaLinha: boolean, vozValida: boolean): number {
  if (dentroDaLinha) return vozValida ? 0.6 : -0.6;
  return vozValida ? 0 : -0.15;
}
