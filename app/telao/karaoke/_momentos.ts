'use client';

// Melhores momentos do karaokê no telão: um COMPOSITOR (canvas 1280x720 com a câmera, a letra, o placar e o cantor), a gravação em dois
// MediaRecorders alternados (ver momentos.ts) e o envio em segundo plano para o Vercel Blob. Tudo só roda se o telão pedir (iniciar).

import { useEffect, useMemo, useState } from 'react';
import { put } from '@vercel/blob/client';
import { api } from '@/app/ui/client';
import {
  COMBO_CLIPE, PASSO_SEGMENTO_MS, PERFEICAO_FRASE, POS_ROLL_MS, PlanejadorMomentos, ROTULO_MOTIVO, VIDA_SEGMENTO_MS,
  escolherSegmento, quebrarPalavras, type LinhaProgresso, type Motivo,
} from './momentos';

export { COMBO_CLIPE, PERFEICAO_FRASE };
export type { Motivo };

const LARG = 1280;
const ALT = 720;
const FPS = 30;
const BITRATE_VIDEO = 2_500_000;
const BITRATE_AUDIO = 128_000;
const TIMESLICE_MS = 1000;
const MIN_BYTES_CLIPE = 20_000;
const MULTIPART_ACIMA = 8 * 1024 * 1024;
const TENTATIVAS_ENVIO = 2;
const INTERVALO_ENVIO_MS = 2000;
const FILAS_NA_MEMORIA = 3;
const OURO = '#ffd45e';
/** Microfone na gravação: nível (mais baixo que o instrumental), quanto a porta segura aberta depois da última voz e o resquício com eco ligado. */
const MIC_NIVEL = 0.7;
const SEGURA_PORTA_MS = 400;
const PISO_PORTA_COM_ECO = 0.1;
const CREME = '#f3ebdc';

const esperar = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, ms); });

// ---------- tipos ----------

/** O que o compositor desenha por cima da câmera a cada quadro (o telão monta isso a partir do que já tem na mão). */
export interface CenaMomento {
  cantor: string;
  musica: string;
  linha: LinhaProgresso | null;
  /** Placar de 0 a 10000, ou null quando a música não tem pontuação ao vivo. */
  pontos: number | null;
  combo: number;
  sequencia: number;
  /** ms que faltam do Modo Estrela (0 se não está ativo). */
  estrelaMs: number;
}

export interface FotoMomento { chave: number; url: string; estado: 'enviando' | 'salva' | 'erro' }

/** Resumo dos momentos de uma música para a tela da nota. */
export interface EstadoMomentos {
  filaId: number;
  fotos: FotoMomento[];
  /** Clipes já salvos. */
  clipes: number;
  /** Fotos mais clipes já salvos. */
  salvos: number;
  /** Ainda esperando envio. */
  pendentes: number;
}

export interface OpcoesMomentos {
  /** Fluxo do microfone do telão, já aberto com cancelamento de eco (o mesmo do detector de tom). */
  obterMic: () => MediaStream | undefined;
  /** Há voz cantada agora (o detector de tom ouviu uma nota). Sem isso a porta do microfone fica sempre aberta. */
  vozAtiva?: () => boolean;
  /** O que o navegador confirmou sobre o cancelamento de eco do microfone (null: não sei). Desligado, a porta fecha por completo sem voz. */
  ecoAtivo?: () => boolean | null;
  /** Elemento <audio> do instrumental (modo estúdio); null no modo YouTube (só o microfone). */
  audio: () => HTMLAudioElement | null;
  lerCena: () => CenaMomento | null;
  /** Canvas da câmera já com filtros (CameraFundo), ou null com a câmera desligada. */
  fonte: () => HTMLCanvasElement | null;
}

// ---------- compositor ----------

function coberturaDe(ctx: CanvasRenderingContext2D, img: CanvasImageSource, lw: number, lh: number) {
  const k = Math.max(LARG / lw, ALT / lh);
  const dw = lw * k;
  const dh = lh * k;
  ctx.drawImage(img, (LARG - dw) / 2, (ALT - dh) / 2, dw, dh);
}

function pilula(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, borda = 'rgba(255, 214, 120, 0.9)') {
  ctx.fillStyle = 'rgba(23, 27, 24, 0.78)';
  ctx.strokeStyle = borda;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.stroke();
}

/** Desenha o vídeo dos melhores momentos: câmera (ou fundo do estúdio), letra, placar, sequência e nome do cantor. */
class Compositor {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private timer: number | undefined;
  private pontosExibidos = 0;

  constructor(private readonly lerCena: () => CenaMomento | null, private readonly fonte: () => HTMLCanvasElement | null) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = LARG;
    this.canvas.height = ALT;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('sem canvas 2d');
    this.ctx = ctx;
  }

  iniciar() {
    this.desenhar();
    this.timer = window.setInterval(() => this.desenhar(), 1000 / FPS);
  }

  parar() { window.clearInterval(this.timer); this.timer = undefined; }

  /** JPEG do que está sendo gravado agora. */
  foto(): Promise<Blob | null> {
    this.desenhar();
    return new Promise((resolve) => this.canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.88));
  }

  /** Câmera natural (sem tom nem escurecimento); sem câmera, um fundo liso escuro. */
  private fundo() {
    const ctx = this.ctx;
    const cam = this.fonte();
    if (cam && cam.width > 1 && cam.height > 1) { coberturaDe(ctx, cam, cam.width, cam.height); return; }
    ctx.fillStyle = '#14181a';
    ctx.fillRect(0, 0, LARG, ALT);
  }

  private desenhar() {
    const ctx = this.ctx;
    const cena = this.lerCena();
    const agora = performance.now();
    ctx.clearRect(0, 0, LARG, ALT);
    this.fundo();

    // Só uma faixa suave atrás da área da letra, embaixo (transparente até 35% de preto). O resto da imagem fica natural.
    const faixa = ctx.createLinearGradient(0, ALT * 0.58, 0, ALT);
    faixa.addColorStop(0, 'rgba(0, 0, 0, 0)');
    faixa.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
    ctx.fillStyle = faixa;
    ctx.fillRect(0, ALT * 0.58, LARG, ALT * 0.42);

    if (cena) {
      this.cabecalho(cena);
      this.placar(cena);
      this.letra(cena.linha);
      if (cena.estrelaMs > 0) this.faixaEstrela(cena.estrelaMs, agora);
    }

    // Selo discreto no canto.
    ctx.save();
    ctx.font = '700 18px Manrope, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(243, 235, 220, 0.7)';
    ctx.fillText('Karaokê Natal em Família 2026', LARG - 22, ALT - 18);
    ctx.restore();
  }

  private cabecalho(cena: CenaMomento) {
    const ctx = this.ctx;
    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = '800 30px Manrope, system-ui, sans-serif';
    const titulo = cena.cantor;
    const w = Math.min(640, ctx.measureText(titulo).width + 56);
    pilula(ctx, 24, 22, w, 52);
    ctx.fillStyle = '#fff6dd';
    ctx.fillText(titulo, 24 + 28, 22 + 27, w - 56);
    ctx.font = '600 22px Manrope, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(243, 235, 220, 0.92)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 6;
    ctx.fillText(cena.musica, 32, 98, 700);
    ctx.restore();
  }

  private placar(cena: CenaMomento) {
    if (cena.pontos === null) return;
    const ctx = this.ctx;
    this.pontosExibidos += (cena.pontos - this.pontosExibidos) * 0.2;
    if (Math.abs(cena.pontos - this.pontosExibidos) < 1) this.pontosExibidos = cena.pontos;
    const texto = Math.round(this.pontosExibidos).toLocaleString('pt-BR');
    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(243, 235, 220, 0.85)';
    ctx.font = '800 18px Manrope, system-ui, sans-serif';
    ctx.fillText('PONTOS', LARG - 28, 36);
    ctx.fillStyle = OURO;
    ctx.font = '800 62px Manrope, system-ui, sans-serif';
    ctx.fillText(texto, LARG - 28, 98);
    if (cena.sequencia > 0) {
      ctx.font = '800 26px Manrope, system-ui, sans-serif';
      ctx.fillStyle = cena.combo > 1 ? OURO : CREME;
      ctx.fillText(`${cena.combo > 1 ? `x${cena.combo}  ` : ''}${cena.sequencia} ${cena.sequencia === 1 ? 'nota seguida' : 'notas seguidas'}`, LARG - 28, 134);
    }
    ctx.restore();
  }

  private letra(linha: LinhaProgresso | null) {
    if (!linha || !linha.palavras.length) return;
    const ctx = this.ctx;
    let tam = 48;
    let quebras: [number, number][] = [];
    for (; tam >= 30; tam -= 4) {
      ctx.font = `800 ${tam}px Manrope, system-ui, sans-serif`;
      quebras = quebrarPalavras(linha.palavras, (t) => ctx.measureText(t).width, LARG - 120);
      if (quebras.length <= 2) break;
    }
    ctx.save();
    ctx.font = `800 ${tam}px Manrope, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const espaco = ctx.measureText(' ').width;
    const alturaLinha = tam * 1.3;
    const yBase = ALT - 70 - (quebras.length - 1) * alturaLinha;
    quebras.forEach(([de, ate], li) => {
      const palavras = linha.palavras.slice(de, ate);
      const larguras = palavras.map((p) => ctx.measureText(p).width);
      const total = larguras.reduce((a, b) => a + b, 0) + espaco * (palavras.length - 1);
      let x = (LARG - total) / 2;
      const y = yBase + li * alturaLinha;
      palavras.forEach((p, k) => {
        const cantada = de + k < linha.cantadas;
        ctx.lineWidth = Math.max(6, tam * 0.16);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.strokeText(p, x, y);
        ctx.fillStyle = cantada ? OURO : CREME;
        ctx.fillText(p, x, y);
        x += larguras[k] + espaco;
      });
    });
    ctx.restore();
  }

  private faixaEstrela(restanteMs: number, agora: number) {
    const ctx = this.ctx;
    const p = 0.5 + 0.5 * Math.sin(agora / 150);
    const w = 420;
    const x = (LARG - w) / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 8;
    pilula(ctx, x, 24, w, 56, `rgba(255, 232, 150, ${0.75 + 0.25 * p})`);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = OURO;
    ctx.font = '800 30px Manrope, system-ui, sans-serif';
    ctx.fillText('MODO ESTRELA  x2', LARG / 2, 53);
    ctx.fillStyle = 'rgba(255, 212, 94, 0.9)';
    ctx.beginPath();
    ctx.roundRect(x + 24, 86, Math.max(8, (w - 48) * Math.min(1, restanteMs / 8000)), 6, 3);
    ctx.fill();
    ctx.restore();
  }
}

// ---------- gravador ----------

interface Segmento {
  inicio: number;
  rec: MediaRecorder;
  chunks: Blob[];
  ativo: boolean;
  /** Chamado no próximo pedaço entregue (para esperar o requestData). */
  flush?: () => void;
}

interface ClipePendente { seg: Segmento; t: number; ms: number; motivo: Motivo; filaId: number; timer: number }

interface ItemEnvio { filaId: number; tipo: 'foto' | 'clipe'; blob: Blob; ms: number; duracao_ms: number | null; motivo: string; chave: number }

interface Recursos {
  comp: Compositor | null;
  ctx: AudioContext | null;
  fluxo: MediaStream | null;
  espelho: { el: HTMLAudioElement; timer: number } | null;
  timerPorta: number | undefined;
  timerSeg: number | undefined;
  segmentos: Segmento[];
}

function escolherMime(): string | null {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') return null;
  for (const m of ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']) if (MediaRecorder.isTypeSupported(m)) return m;
  return null;
}

class GravadorMomentos {
  private readonly plano = new PlanejadorMomentos();
  private r: Recursos = { comp: null, ctx: null, fluxo: null, espelho: null, timerPorta: undefined, timerSeg: undefined, segmentos: [] };
  private filaId: number | null = null;
  private mime = '';
  private pendentes: ClipePendente[] = [];
  private readonly fila: ItemEnvio[] = [];
  private enviando = false;
  private chave = 0;
  private readonly estados = new Map<number, EstadoMomentos>();
  private readonly fechadas = new Set<number>();
  private readonly reelPedido = new Set<number>();
  private foco: number | null = null;

  private opcoes: OpcoesMomentos | null = null;

  constructor(private readonly aoMudar: (e: EstadoMomentos | null) => void) {}

  /** O telão renova as funções de leitura a cada render; o gravador usa sempre as últimas. */
  definirOpcoes(o: OpcoesMomentos) { this.opcoes = o; }

  // ----- estado para a tela -----

  private atualizar(filaId: number, fn: (e: EstadoMomentos) => EstadoMomentos) {
    const atual = this.estados.get(filaId);
    if (!atual) return;
    const novo = fn(atual);
    this.estados.set(filaId, novo);
    if (this.foco === filaId) this.aoMudar(novo);
  }

  private abrirEstado(filaId: number) {
    this.estados.set(filaId, { filaId, fotos: [], clipes: 0, salvos: 0, pendentes: 0 });
    this.foco = filaId;
    this.aoMudar(this.estados.get(filaId) ?? null);
    // Só as últimas músicas ficam na memória (as miniaturas são object URLs).
    while (this.estados.size > FILAS_NA_MEMORIA) {
      const velho = this.estados.keys().next().value as number;
      for (const f of this.estados.get(velho)?.fotos ?? []) URL.revokeObjectURL(f.url);
      this.estados.delete(velho);
      this.fechadas.delete(velho);
      this.reelPedido.delete(velho);
    }
  }

  // ----- gravação -----

  /** Começa a gravar a música (chamar quando o som começa a tocar). Devolve false se o navegador não grava ou já está gravando. */
  iniciar = (filaId: number, comInstrumental: boolean): boolean => {
    if (this.filaId === filaId) return true;
    if (this.filaId !== null) void this.encerrar(this.filaId);
    const mime = escolherMime();
    const d = this.opcoes;
    if (!mime || !d) return false;
    try {
      this.mime = mime;
      this.plano.reiniciar();
      this.abrirEstado(filaId);
      const comp = new Compositor(d.lerCena, d.fonte);
      comp.iniciar();

      const faixas: MediaStreamTrack[] = [...comp.canvas.captureStream(FPS).getVideoTracks()];
      let ctx: AudioContext | null = null;
      let espelho: Recursos['espelho'] = null;
      let timerPorta: number | undefined;
      try {
        ctx = new AudioContext();
        void ctx.resume().catch(() => undefined);
        const destino = ctx.createMediaStreamDestination();
        const mic = d.obterMic();
        if (mic && mic.getAudioTracks().length) timerPorta = this.ligarMic(ctx, destino, mic);
        if (comInstrumental) {
          const principal = d.audio();
          if (principal) espelho = this.criarEspelho(ctx, destino, principal);
        }
        faixas.push(...destino.stream.getAudioTracks());
      } catch (e) { console.error('karaoke: áudio dos momentos', e); }

      const fluxo = new MediaStream(faixas);
      this.r = { comp, ctx, fluxo, espelho, timerPorta, timerSeg: undefined, segmentos: [] };
      this.filaId = filaId;
      this.abrirSegmento();
      this.r.timerSeg = window.setInterval(() => this.abrirSegmento(), PASSO_SEGMENTO_MS);
      return true;
    } catch (e) {
      console.error('karaoke: não consegui iniciar a gravação dos momentos', e);
      this.filaId = null;
      this.liberar(this.r);
      this.r = { comp: null, ctx: null, fluxo: null, espelho: null, timerPorta: undefined, timerSeg: undefined, segmentos: [] };
      return false;
    }
  };

  /**
   * Microfone -> passa-altas 120 Hz -> porta de ruído -> nível -> gravação. A música que a TV toca e o microfone capta não pode dobrar no vídeo:
   * o fluxo já vem com cancelamento de eco; a porta fecha quando ninguém canta (com o eco desligado, fecha por completo; ligado, deixa um
   * resquício de 10% para o som não parecer cortado) e o microfone entra mais baixo que o instrumental limpo.
   */
  private ligarMic(ctx: AudioContext, destino: MediaStreamAudioDestinationNode, mic: MediaStream): number {
    const passaAltas = ctx.createBiquadFilter();
    passaAltas.type = 'highpass';
    passaAltas.frequency.value = 120;
    passaAltas.Q.value = 0.707;
    const porta = ctx.createGain();
    porta.gain.value = 0;
    const nivel = ctx.createGain();
    nivel.gain.value = MIC_NIVEL;
    ctx.createMediaStreamSource(mic).connect(passaAltas);
    passaAltas.connect(porta);
    porta.connect(nivel);
    nivel.connect(destino);
    let ultimaVoz = -Infinity;
    let aberta = false;
    let piso = -1;
    return window.setInterval(() => {
      const o = this.opcoes;
      const agora = performance.now();
      if (!o?.vozAtiva || o.vozAtiva()) ultimaVoz = agora;
      const devAbrir = agora - ultimaVoz < SEGURA_PORTA_MS;
      const novoPiso = o?.ecoAtivo?.() === true ? PISO_PORTA_COM_ECO : 0;
      if (devAbrir === aberta && novoPiso === piso) return;
      aberta = devAbrir;
      piso = novoPiso;
      porta.gain.setTargetAtTime(aberta ? 1 : piso, ctx.currentTime, aberta ? 0.005 : 0.15);
    }, 33);
  }

  /**
   * O instrumental entra na gravação por uma CÓPIA do <audio> (mesmo endereço, em modo CORS anônimo) que toca só para o gravador, em sincronia
   * com o original. Assim o som da TV nunca passa pelo WebAudio (nada pode calar o karaokê) e, se o servidor não liberar CORS, só some do vídeo.
   */
  private criarEspelho(ctx: AudioContext, destino: MediaStreamAudioDestinationNode, principal: HTMLAudioElement): Recursos['espelho'] {
    const url = principal.currentSrc || principal.src;
    if (!url) return null;
    const el = new Audio();
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    el.src = url;
    const g = ctx.createGain();
    g.gain.value = 0.9;
    ctx.createMediaElementSource(el).connect(g);
    g.connect(destino);
    el.currentTime = principal.currentTime;
    el.play().catch(() => undefined);
    const timer = window.setInterval(() => {
      if (principal.paused || principal.ended) { if (!el.paused) el.pause(); return; }
      if (el.paused) el.play().catch(() => undefined);
      if (Math.abs(el.currentTime - principal.currentTime) > 0.12) el.currentTime = principal.currentTime;
    }, 500);
    return { el, timer };
  }

  private abrirSegmento() {
    const fluxo = this.r.fluxo;
    if (!fluxo) return;
    let rec: MediaRecorder;
    try { rec = new MediaRecorder(fluxo, { mimeType: this.mime, videoBitsPerSecond: BITRATE_VIDEO, audioBitsPerSecond: BITRATE_AUDIO }); }
    catch (e) { console.error('karaoke: MediaRecorder', e); return; }
    const seg: Segmento = { inicio: performance.now(), rec, chunks: [], ativo: true };
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) seg.chunks.push(e.data);
      const f = seg.flush; seg.flush = undefined; f?.();
    };
    rec.onstop = () => { seg.ativo = false; const f = seg.flush; seg.flush = undefined; f?.(); };
    rec.onerror = () => { seg.ativo = false; };
    try { rec.start(TIMESLICE_MS); } catch (e) { console.error('karaoke: start', e); return; }
    this.r.segmentos.push(seg);
    // Só os dois gravadores mais novos continuam; o mais antigo fecha (a vida de cada um é de dois passos).
    const vivos = this.r.segmentos.filter((s) => s.ativo);
    while (vivos.length > 2) this.fechar(vivos.shift() as Segmento);
    this.r.segmentos = this.r.segmentos.filter((s) => s.ativo || this.pendentes.some((p) => p.seg === s));
  }

  private fechar(seg: Segmento) {
    try { if (seg.rec.state !== 'inactive') seg.rec.stop(); } catch { /* já parado */ }
  }

  /** Espera o MediaRecorder entregar o que ainda está no buffer. */
  private esvaziar(seg: Segmento): Promise<void> {
    if (!seg.ativo || seg.rec.state !== 'recording') return Promise.resolve();
    return new Promise<void>((resolve) => {
      const limite = window.setTimeout(resolve, 1200);
      seg.flush = () => { window.clearTimeout(limite); resolve(); };
      try { seg.rec.requestData(); } catch { window.clearTimeout(limite); resolve(); }
    });
  }

  /**
   * Um momento aconteceu: foto (frase perfeita) e clipe (frase perfeita, sequência x3 ou x4, Modo Estrela), respeitando os limites por música.
   * ms: posição da música no instante.
   */
  gatilho = (motivo: Motivo, ms: number) => {
    if (this.filaId === null || !this.r.comp) return;
    if (motivo === 'frase') this.tirarFoto(ms, motivo);
    const agora = performance.now();
    if (!this.plano.pedirClipe(agora)) return;
    const vivos = this.r.segmentos.filter((s) => s.ativo);
    const i = escolherSegmento(vivos.map((s) => ({ inicio: s.inicio, vida: VIDA_SEGMENTO_MS })), agora);
    if (i < 0) { this.plano.devolverClipe(); return; }
    const filaId = this.filaId;
    const p: ClipePendente = { seg: vivos[i], t: agora, ms, motivo, filaId, timer: 0 };
    p.timer = window.setTimeout(() => void this.concluirClipe(p), POS_ROLL_MS);
    this.pendentes.push(p);
  };

  private tirarFoto(ms: number, motivo: Motivo) {
    const comp = this.r.comp;
    const filaId = this.filaId;
    if (!comp || filaId === null || !this.plano.pedirFoto()) return;
    void comp.foto().then((blob) => {
      if (blob && blob.size > 0) this.enfileirar({ filaId, tipo: 'foto', blob, ms, duracao_ms: null, motivo: ROTULO_MOTIVO[motivo], chave: ++this.chave });
    }).catch(() => undefined);
  }

  private async concluirClipe(p: ClipePendente) {
    window.clearTimeout(p.timer);
    const i = this.pendentes.indexOf(p);
    if (i < 0) return;
    this.pendentes.splice(i, 1);
    try {
      await this.esvaziar(p.seg);
      const blob = new Blob(p.seg.chunks, { type: 'video/webm' });
      if (blob.size < MIN_BYTES_CLIPE) return;
      const fim = Math.min(performance.now(), p.seg.inicio + VIDA_SEGMENTO_MS);
      this.enfileirar({ filaId: p.filaId, tipo: 'clipe', blob, ms: p.ms, duracao_ms: Math.round(fim - p.seg.inicio), motivo: ROTULO_MOTIVO[p.motivo], chave: ++this.chave });
    } catch (e) { console.error('karaoke: clipe', e); }
  }

  /** Fim da música (ou música abortada): fecha os clipes que faltam, para tudo e deixa os envios terminarem em segundo plano. */
  encerrar = async (filaId: number): Promise<void> => {
    if (this.filaId !== filaId) { this.marcarFechada(filaId); return; }
    this.filaId = null;
    const recursos = this.r;
    this.r = { comp: null, ctx: null, fluxo: null, espelho: null, timerPorta: undefined, timerSeg: undefined, segmentos: [] };
    window.clearInterval(recursos.timerSeg);
    const meus = this.pendentes.filter((p) => p.filaId === filaId);
    await Promise.all(meus.map((p) => this.concluirClipe(p)));
    this.liberar(recursos);
    this.marcarFechada(filaId);
  };

  private liberar(r: Recursos) {
    window.clearInterval(r.timerSeg);
    window.clearInterval(r.timerPorta);
    for (const s of r.segmentos) this.fechar(s);
    r.comp?.parar();
    if (r.espelho) { window.clearInterval(r.espelho.timer); r.espelho.el.pause(); r.espelho.el.removeAttribute('src'); r.espelho.el.load(); }
    r.fluxo?.getTracks().forEach((t) => t.stop());
    void r.ctx?.close().catch(() => undefined);
  }

  destruir = () => {
    for (const p of this.pendentes) window.clearTimeout(p.timer);
    this.pendentes = [];
    this.filaId = null;
    this.liberar(this.r);
    this.r = { comp: null, ctx: null, fluxo: null, espelho: null, timerPorta: undefined, timerSeg: undefined, segmentos: [] };
  };

  // ----- envio em segundo plano -----

  private enfileirar(item: ItemEnvio) {
    const url = item.tipo === 'foto' ? URL.createObjectURL(item.blob) : null;
    this.atualizar(item.filaId, (e) => ({
      ...e,
      pendentes: e.pendentes + 1,
      fotos: url ? [...e.fotos, { chave: item.chave, url, estado: 'enviando' }] : e.fotos,
    }));
    this.fila.push(item);
    void this.processar();
  }

  private async processar() {
    if (this.enviando) return;
    this.enviando = true;
    try {
      while (this.fila.length) {
        const item = this.fila.shift() as ItemEnvio;
        const ok = await this.enviar(item);
        this.atualizar(item.filaId, (e) => ({
          ...e,
          pendentes: Math.max(0, e.pendentes - 1),
          clipes: e.clipes + (ok && item.tipo === 'clipe' ? 1 : 0),
          salvos: e.salvos + (ok ? 1 : 0),
          fotos: e.fotos.map((f) => (f.chave === item.chave ? { ...f, estado: ok ? 'salva' : 'erro' } : f)),
        }));
        this.verificarReel(item.filaId);
      }
    } finally { this.enviando = false; }
  }

  /** Token de cliente do servidor, envio direto ao Blob (sem passar o arquivo pelo servidor) e registro. 2 tentativas. */
  private async enviar(item: ItemEnvio): Promise<boolean> {
    for (let t = 0; t < TENTATIVAS_ENVIO; t++) {
      if (t > 0) await esperar(INTERVALO_ENVIO_MS);
      try {
        const { token, pathname } = await api<{ token: string; pathname: string }>('/api/karaoke/momentos/upload', { method: 'POST', json: { fila_id: item.filaId, tipo: item.tipo } });
        const r = await put(pathname, item.blob, {
          access: 'public',
          token,
          contentType: item.tipo === 'foto' ? 'image/jpeg' : 'video/webm',
          multipart: item.blob.size > MULTIPART_ACIMA,
        });
        await api('/api/karaoke/momentos', { method: 'POST', json: { fila_id: item.filaId, tipo: item.tipo, url: r.url, ms: item.ms, duracao_ms: item.duracao_ms, motivo: item.motivo } });
        return true;
      } catch (e) { console.error('karaoke: envio do momento', e); }
    }
    return false;
  }

  private marcarFechada(filaId: number) {
    this.fechadas.add(filaId);
    this.verificarReel(filaId);
  }

  /** Música terminada, nada mais para enviar e pelo menos 1 clipe salvo: pede o vídeo de melhores momentos (reel_status = 'pendente'). */
  private verificarReel(filaId: number) {
    const e = this.estados.get(filaId);
    if (!e || !this.fechadas.has(filaId) || this.reelPedido.has(filaId)) return;
    if (this.fila.some((i) => i.filaId === filaId) || this.pendentes.some((p) => p.filaId === filaId) || e.pendentes > 0 || e.clipes < 1) return;
    this.reelPedido.add(filaId);
    void (async () => {
      for (let t = 0; t < TENTATIVAS_ENVIO; t++) {
        if (t > 0) await esperar(INTERVALO_ENVIO_MS);
        try { await api('/api/karaoke/fila', { method: 'PATCH', json: { acao: 'reel', id: filaId } }); return; }
        catch (err) { console.error('karaoke: pedido do vídeo de melhores momentos', err); }
      }
    })();
  }
}

/** Gravador dos melhores momentos do telão. iniciar/gatilho/encerrar são estáveis (não mudam entre renders). */
export function useMomentos(opcoes: OpcoesMomentos) {
  const [estado, setEstado] = useState<EstadoMomentos | null>(null);
  const [g] = useState(() => new GravadorMomentos(setEstado));
  useEffect(() => { g.definirOpcoes(opcoes); });
  useEffect(() => () => g.destruir(), [g]);
  return useMemo(() => ({ estado, iniciar: g.iniciar, gatilho: g.gatilho, encerrar: g.encerrar }), [estado, g]);
}

// ---------- som do Modo Estrela ----------

let ctxSom: AudioContext | null = null;

/** "Whoosh" de ruído filtrado subindo e descendo, mais um brilho agudo. */
export function tocarWhoosh() {
  try {
    ctxSom ??= new AudioContext();
    const ctx = ctxSom;
    void ctx.resume().catch(() => undefined);
    const t = ctx.currentTime;
    const dur = 1.2;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const ruido = ctx.createBufferSource();
    ruido.buffer = buf;
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.Q.value = 1.4;
    filtro.frequency.setValueAtTime(250, t);
    filtro.frequency.exponentialRampToValueAtTime(5200, t + 0.7);
    filtro.frequency.exponentialRampToValueAtTime(1200, t + dur);
    const ganho = ctx.createGain();
    ganho.gain.setValueAtTime(0.0001, t);
    ganho.gain.exponentialRampToValueAtTime(0.8, t + 0.5);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    ruido.connect(filtro);
    filtro.connect(ganho);
    ganho.connect(ctx.destination);
    ruido.start(t);
    ruido.stop(t + dur);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(1760, t + 0.6);
    const go = ctx.createGain();
    go.gain.setValueAtTime(0.0001, t);
    go.gain.exponentialRampToValueAtTime(0.12, t + 0.4);
    go.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    osc.connect(go);
    go.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.95);
  } catch { /* sem áudio: o efeito visual segue */ }
}
