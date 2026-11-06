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
  /** 'letra': nota só dentro das linhas da letra; ausente ou 'video': música inteira. */
  modo?: 'letra' | 'video';
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
