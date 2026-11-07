// Gestos do estilo Kinect (Modo Estrela e acenar para começar). Funções e classes puras, sem imports: testadas por gestos.test.mjs.
// As coordenadas são as do MediaPipe PoseLandmarker: normalizadas (0..1) no quadro do vídeo, y cresce para baixo.

export type Pt = { x: number; y: number; /** visibilidade 0..1 */ v: number };
export type Postura = { nariz: Pt; ombroE: Pt; ombroD: Pt; pulsoE: Pt; pulsoD: Pt };
export type EventoGesto = 'estrela' | 'aceno';

/** Ponto só vale com esta visibilidade. */
export const VISIBILIDADE_MIN = 0.5;
/** Pulsos acima da cabeça por este tempo disparam o Modo Estrela. */
export const ESTRELA_SEGURAR_MS = 500;
/** Falhas curtas da detecção (a 10 quadros por segundo) não reiniciam a contagem. */
export const TOLERANCIA_FALHA_MS = 250;
/** Acenar: idas e voltas laterais do pulso (acima do ombro) dentro desta janela. */
export const ACENO_JANELA_MS = 2500;
/** 3 idas e voltas = a primeira ida define a direção e mais 5 inversões de sentido. */
export const ACENO_INVERSOES = 5;
/** Curso mínimo (largura do quadro) de cada ida ou volta: abaixo disso é tremor da detecção. */
export const ACENO_CURSO_MIN = 0.035;
/** Depois de um aceno reconhecido, ignora novos por este tempo. */
export const ACENO_PAUSA_MS = 3000;

const visivel = (p: Pt) => p.v >= VISIBILIDADE_MIN;

/** Os dois pulsos acima da cabeça (topo da cabeça estimado a partir do nariz e da largura dos ombros). */
export function bracosAcimaDaCabeca(p: Postura): boolean {
  if (!visivel(p.nariz) || !visivel(p.pulsoE) || !visivel(p.pulsoD)) return false;
  const largura = Math.max(0.08, Math.abs(p.ombroE.x - p.ombroD.x));
  const topo = p.nariz.y - 0.3 * largura;
  return p.pulsoE.y < topo && p.pulsoD.y < topo;
}

/** Pulso levantado acima do ombro do mesmo lado (posição de acenar). */
export function pulsoAcimaDoOmbro(pulso: Pt, ombro: Pt): boolean {
  return visivel(pulso) && ombro.v >= 0.3 && pulso.y < ombro.y;
}

/** Conta inversões de sentido do pulso no eixo x, com curso mínimo, numa janela de tempo. */
class RastroAceno {
  private dir = 0;
  private extremo = 0;
  private iniciado = false;
  private inversoes: number[] = [];

  reiniciar() { this.dir = 0; this.iniciado = false; this.inversoes = []; }

  /** Devolve true quando completou as idas e voltas dentro da janela. */
  amostra(t: number, x: number): boolean {
    if (!this.iniciado) { this.iniciado = true; this.extremo = x; }
    if (this.dir === 0) {
      if (Math.abs(x - this.extremo) >= ACENO_CURSO_MIN) { this.dir = x > this.extremo ? 1 : -1; this.extremo = x; }
    } else if (this.dir > 0) {
      if (x > this.extremo) this.extremo = x;
      else if (this.extremo - x >= ACENO_CURSO_MIN) { this.inversoes.push(t); this.dir = -1; this.extremo = x; }
    } else {
      if (x < this.extremo) this.extremo = x;
      else if (x - this.extremo >= ACENO_CURSO_MIN) { this.inversoes.push(t); this.dir = 1; this.extremo = x; }
    }
    while (this.inversoes.length && t - this.inversoes[0] > ACENO_JANELA_MS) this.inversoes.shift();
    return this.inversoes.length >= ACENO_INVERSOES;
  }
}

/**
 * Reconhece os gestos a partir das posturas (uma por pessoa) de cada detecção. Chame atualizar(agoraMs, posturas) a cada detecção;
 * devolve os gestos que acabaram de ser reconhecidos. A pessoa é identificada pela ordem esquerda-direita (nariz.x).
 */
export class DetectorGestos {
  private acimaDesde = -1;
  private ultimoAcima = -Infinity;
  private estrelaDisparada = false;
  private readonly rastros = new Map<string, RastroAceno>();
  private proximoAceno = 0;

  reiniciar() {
    this.acimaDesde = -1; this.ultimoAcima = -Infinity; this.estrelaDisparada = false;
    this.rastros.clear(); this.proximoAceno = 0;
  }

  atualizar(t: number, posturas: readonly Postura[]): EventoGesto[] {
    const eventos: EventoGesto[] = [];
    const ordenadas = [...posturas].sort((a, b) => a.nariz.x - b.nariz.x);

    // Modo Estrela: qualquer pessoa com os dois pulsos acima da cabeça por 0,5 s; só dispara de novo depois de baixar os braços.
    if (ordenadas.some(bracosAcimaDaCabeca)) {
      this.ultimoAcima = t;
      if (this.acimaDesde < 0) this.acimaDesde = t;
      if (!this.estrelaDisparada && t - this.acimaDesde >= ESTRELA_SEGURAR_MS) { this.estrelaDisparada = true; eventos.push('estrela'); }
    } else if (t - this.ultimoAcima > TOLERANCIA_FALHA_MS) {
      this.acimaDesde = -1; this.estrelaDisparada = false;
    }

    // Acenar: pulso acima do ombro indo e voltando de lado.
    const vivos = new Set<string>();
    ordenadas.forEach((p, i) => {
      const lados: [string, Pt, Pt][] = [[`${i}E`, p.pulsoE, p.ombroE], [`${i}D`, p.pulsoD, p.ombroD]];
      for (const [chave, pulso, ombro] of lados) {
        if (!pulsoAcimaDoOmbro(pulso, ombro)) continue;
        vivos.add(chave);
        let r = this.rastros.get(chave);
        if (!r) { r = new RastroAceno(); this.rastros.set(chave, r); }
        if (r.amostra(t, pulso.x) && t >= this.proximoAceno) {
          this.proximoAceno = t + ACENO_PAUSA_MS;
          eventos.push('aceno');
          r.reiniciar();
        }
      }
    });
    for (const chave of [...this.rastros.keys()]) if (!vivos.has(chave)) this.rastros.delete(chave);
    return eventos;
  }
}

/**
 * Modo Estrela do telão: liberado quando a sequência chega a x3 na música, dura 8 s e só pode ser ativado de novo 45 s depois do início do anterior.
 * O tempo é o do relógio (ms), o mesmo que o telão usa nos gestos.
 */
export class ControleEstrela {
  liberada = false;
  private ativaAte = 0;
  private ultimoInicio = -Infinity;

  constructor(readonly duracaoMs = 8000, readonly intervaloMs = 45000, readonly comboMinimo = 3) {}

  /** Nova música: precisa chegar a x3 de novo para liberar; o intervalo de 45 s continua valendo. */
  novaMusica() { this.liberada = false; this.ativaAte = 0; }
  reiniciar() { this.liberada = false; this.ativaAte = 0; this.ultimoInicio = -Infinity; }
  registrarCombo(combo: number) { if (combo >= this.comboMinimo) this.liberada = true; }
  ativa(agora: number): boolean { return agora < this.ativaAte; }
  restanteMs(agora: number): number { return Math.max(0, this.ativaAte - agora); }
  disponivel(agora: number): boolean { return this.liberada && !this.ativa(agora) && agora - this.ultimoInicio >= this.intervaloMs; }
  /** Ativa se estiver disponível; devolve se ativou. */
  ativar(agora: number): boolean {
    if (!this.disponivel(agora)) return false;
    this.ultimoInicio = agora;
    this.ativaAte = agora + this.duracaoMs;
    return true;
  }
}
