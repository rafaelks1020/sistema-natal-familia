'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PitchDetector } from 'pitchy';
import { acharPulso, gerarPulso, medianaDeAtrasos, medicoesConsistentes } from './atraso';
import { DetectorMicrofonia, GerenciadorMicrofonia, MAX_CORTES, Q_CORTE } from './anti-microfonia';
import { CLAREZA_ESTUDIO, CLAREZA_MINIMA, HZ_MAX, HZ_MIN, hzParaMidi, limiarDeVoz, limiarDeVozEstudio, medirRuido, type Quadro } from './pontuacao';

// Microfone do telão: abre o dispositivo escolhido, mede a altura da voz com pitchy e (opcional) devolve a voz na TV com reverb.
// A parte de contas (nota, estrelas) fica em pontuacao.ts, que é pura e testada.
export * from './pontuacao';

export type Dispositivo = { deviceId: string; label: string };
export type Vivo = { midi: number | null; hz: number; rms: number; cantando: boolean; limiar: number };
export type PontoAltura = { t: number; midi: number | null };
export type StatusMic = 'parado' | 'abrindo' | 'ativo' | 'erro';
/** Anti-microfonia da Voz na TV: cortes ativos, redução de ganho (dB) e quantos avisos de retorno já houve. */
export type EstadoAntiMic = { cortes: number; reducaoDb: number; avisos: number };
/** Monitoração da Voz na TV: contexto de áudio próprio (menor buffer), taxa, latências do navegador e se o microfone cru é um stream separado. */
export type InfoMonitor = { taxa: number; baseMs: number; saidaMs: number; separado: boolean; eco: boolean | null };
/** Cancelador adaptativo de retorno: ativo (tem atraso medido), quanto tira do retorno nos agudos (dB) e quantas vezes reaprendeu. */
export type InfoAfc = { ativo: boolean; erle: number | null; resets: number; atraso: number };
export type ResultadoAtraso = { atrasoMs: number | null; medidas: number[]; falhas: number; inconsistente: boolean; razoes: number[] };
export const AVISO_RETORNO = 'Retorno detectado: abaixei a voz na TV. Afaste o microfone da caixa.';

/** Impulso sintético de sala: ruído com decaimento exponencial. */
export function criarImpulso(ctx: BaseAudioContext, segundos = 2.2, decaimento = 3): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * segundos);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decaimento);
  }
  return buf;
}

/** Código do AudioWorklet: guarda as últimas 2048 amostras e avisa a página a cada ~33 ms (passo), com o instante do fim do trecho. */
const CODIGO_CAPTURA = `
class Captura extends AudioWorkletProcessor {
  constructor(opcoes) {
    super();
    this.n = opcoes.processorOptions.janela;
    this.passo = opcoes.processorOptions.passo;
    this.buf = new Float32Array(this.n);
    this.pos = 0;
    this.cont = 0;
    this.total = 0;
  }
  process(entradas) {
    const canal = entradas[0] && entradas[0][0];
    if (!canal) return true;
    for (let i = 0; i < canal.length; i++) { this.buf[this.pos] = canal[i]; this.pos = (this.pos + 1) % this.n; }
    this.cont += canal.length;
    this.total += canal.length;
    if (this.cont >= this.passo && this.total >= this.n) {
      this.cont -= this.passo;
      const saida = new Float32Array(this.n);
      saida.set(this.buf.subarray(this.pos), 0);
      saida.set(this.buf.subarray(0, this.pos), this.n - this.pos);
      this.port.postMessage({ t: currentTime + canal.length / sampleRate, buf: saida }, [saida.buffer]);
    }
    return true;
  }
}
registerProcessor('karaoke-captura', Captura);
`;

/** Código do AudioWorklet da medição: grava N amostras do microfone e devolve com o instante (relógio do contexto) da primeira. */
const CODIGO_MEDIDA = `
class Medida extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = null;
    this.pos = 0;
    this.t0 = -1;
    this.port.onmessage = (e) => { if (e.data.tipo === 'gravar') { this.buf = new Float32Array(e.data.amostras); this.pos = 0; this.t0 = -1; } };
  }
  process(entradas) {
    const c = entradas[0] && entradas[0][0];
    if (this.buf && c) {
      if (this.t0 < 0) this.t0 = currentTime;
      const n = Math.min(c.length, this.buf.length - this.pos);
      this.buf.set(c.subarray(0, n), this.pos);
      this.pos += n;
      if (this.pos >= this.buf.length) { const b = this.buf; this.buf = null; this.port.postMessage({ t0: this.t0, buf: b }, [b.buffer]); }
    }
    return true;
  }
}
registerProcessor('karaoke-medida', Medida);
`;

/**
 * Código do AudioWorklet da Voz na TV (no caminho do som, sem atraso: processa dentro do mesmo bloco de 128 amostras). Ordem:
 * 1) Cancelador adaptativo de retorno (AFC): o worklet sabe exatamente o que mandou para as caixas (é a própria saída dele) e, com o atraso
 *    caixa -> microfone medido por "Medir atraso", um filtro NLMS de 384 coeficientes aprende o caminho da sala e subtrai do microfone o som
 *    que voltou. Só nos agudos (acima de ~700 Hz, onde caixa de notebook e TV apitam e onde o deslocador descorrelaciona a voz do retorno,
 *    variante AFC-FS de van Waterschoot e Moonen). Protegido contra divergência: se piorar o sinal, zera e reaprende.
 * 2) Deslocador de frequência nos agudos (+6 Hz): a cada volta pela sala o som sobe um pouco e o apito não se forma (3 a 6 dB a mais).
 *    Hilbert por dois ramos de passa-tudo IIR (Olli Niemitalo, 90 graus de 20 Hz a 20 kHz, sem atraso).
 * 3) Expansor: nas pausas (voz limpa abaixo do ruído da sala + 10 dB) baixa a voz 12 dB, abrindo em 1 ms.
 * 4) Volume e limitador (reta até 0,6 e joelho suave), aqui dentro para a referência do cancelador ser o som que sai de fato.
 */
const CODIGO_MONITOR = `
const A = [0.6923878, 0.9360654322959, 0.9882295226860, 0.9987488452737].map((c) => c * c);
const B = [0.4021921162426, 0.8561710882420, 0.9722909545651, 0.9952884791278].map((c) => c * c);
function cadeia(c) {
  const s = c.map(() => [0, 0, 0, 0]);
  return (x) => { for (let i = 0; i < c.length; i++) { const z = s[i]; const y = c[i] * (x + z[3]) - z[1]; z[1] = z[0]; z[0] = x; z[3] = z[2]; z[2] = y; x = y; } return x; };
}
function passaBaixas(fc, sr) {
  const w = 2 * Math.PI * fc / sr; const al = Math.sin(w) / (2 * Math.SQRT1_2); const c = Math.cos(w); const a0 = 1 + al;
  const b0 = (1 - c) / 2 / a0; const b1 = (1 - c) / a0; const a1 = -2 * c / a0; const a2 = (1 - al) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => { const y = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}
const limitar = (x) => { const a = Math.abs(x); return a <= 0.6 ? x : Math.sign(x) * (0.6 + 0.4 * Math.tanh((a - 0.6) / 0.4)); };
const L = 384;          // coeficientes do cancelador (8 ms a 48 kHz)
const ANTES = 32;       // folga antes do atraso medido (amostras)
const TAM = 65536;      // histórico da saída (1,36 s a 48 kHz)
const MASCARA = TAM - 1;
class Monitor extends AudioWorkletProcessor {
  constructor(opcoes) {
    super();
    this.desloc = 6; this.expansor = true; this.ganho = 1; this.ganhoAlvo = 1;
    this.a = cadeia(A); this.b = cadeia(B); this.atrasoA = 0; this.fase = 0;
    this.lp1 = passaBaixas(700, sampleRate); this.lp2 = passaBaixas(700, sampleRate);
    this.rl1 = passaBaixas(700, sampleRate); this.rl2 = passaBaixas(700, sampleRate);
    this.env = 0; this.piso = 0.003; this.g = 1; this.segura = 0;
    this.kAtaque = 1 - Math.exp(-1 / (0.001 * sampleRate));
    this.kSolta = 1 - Math.exp(-1 / (0.08 * sampleRate));
    this.kAbre = 1 - Math.exp(-1 / (0.001 * sampleRate));
    this.kFecha = 1 - Math.exp(-1 / (0.2 * sampleRate));
    this.kPisoSobe = 1 - Math.exp(-1 / (4 * sampleRate));
    this.kPisoDesce = 1 - Math.exp(-1 / (0.3 * sampleRate));
    this.kGanho = 1 - Math.exp(-1 / (0.03 * sampleRate));
    this.kPot = 1 - Math.exp(-1 / (0.3 * sampleRate));
    this.seguraN = Math.round(0.15 * sampleRate);
    // Cancelador
    this.ref = new Float32Array(TAM); this.pos = 0; this.w = new Float32Array(L); this.potRef = 0;
    this.atraso = 0; this.afcLigado = true; this.mu = 0.001;
    this.px = 0; this.pe = 0; this.ruim = 0; this.reset = 0; this.cont = 0;
    this.port.onmessage = (e) => {
      const d = e.data || {};
      if (typeof d.desloc === 'number') this.desloc = d.desloc;
      if (typeof d.mu === 'number') this.mu = d.mu;
      if (typeof d.expansor === 'boolean') this.expansor = d.expansor;
      if (typeof d.ganho === 'number') this.ganhoAlvo = Math.max(0, Math.min(2, d.ganho));
      if (typeof d.afc === 'boolean') { this.afcLigado = d.afc; if (!d.afc) this.w.fill(0); }
      if (typeof d.atraso === 'number') this.definirAtraso(d.atraso);
    };
    const po = (opcoes && opcoes.processorOptions) || {};
    if (typeof po.atraso === 'number') this.definirAtraso(po.atraso);
    if (typeof po.ganho === 'number') { this.ganhoAlvo = po.ganho; this.ganho = po.ganho; }
  }
  definirAtraso(v) {
    const n = Math.round(v);
    if (n !== this.atraso) { this.atraso = n > ANTES + 1 && n + L < TAM ? n : 0; this.w.fill(0); this.recalcular(); }
  }
  recalcular() {
    let s = 0;
    for (let k = 0; k < L; k++) { const v = this.ref[(this.pos - this.atraso + ANTES - k + TAM * 2) & MASCARA]; s += v * v; }
    this.potRef = s;
  }
  process(entradas, saidas) {
    const ent = entradas[0] && entradas[0][0];
    const sai = saidas[0] && saidas[0][0];
    if (!sai) return true;
    const w = 2 * Math.PI * this.desloc / sampleRate;
    const usarAfc = this.afcLigado && this.atraso > 0;
    const wv = this.w; const ref = this.ref;
    for (let n = 0; n < sai.length; n++) {
      const x = ent ? ent[n] : 0;
      const grave = this.lp2(this.lp1(x));
      let agudo = x - grave;
      // 1) Cancelador: estimativa do retorno = filtro aplicado aos agudos do que saiu há "atraso" amostras.
      if (usarAfc) {
        const base = this.pos - this.atraso + ANTES + TAM * 2;
        // Janela deslizante da potência da referência (entra a mais nova, sai a mais velha).
        const novo = ref[base & MASCARA]; const velho = ref[(base - L) & MASCARA];
        this.potRef += novo * novo - velho * velho;
        if (this.potRef < 0) this.potRef = 0;
        let est = 0;
        for (let k = 0; k < L; k++) est += wv[k] * ref[(base - k) & MASCARA];
        const e = agudo - est;
        this.px += this.kPot * (agudo * agudo - this.px);
        this.pe += this.kPot * (e * e - this.pe);
        if (this.potRef > L * 1e-7) {
          const passo = this.mu * e / (this.potRef + 1e-6);
          for (let k = 0; k < L; k++) wv[k] += passo * ref[(base - k) & MASCARA];
        }
        // Proteção: se o cancelador piorou o sinal (erro bem maior que a entrada) por 300 ms, zera e reaprende.
        if (this.pe > 2 * this.px + 1e-9) { if (++this.ruim > 0.3 * sampleRate) { wv.fill(0); this.ruim = 0; this.reset++; } }
        else this.ruim = 0;
        agudo = e;
      }
      // 2) Deslocador de frequência nos agudos.
      let y = grave + agudo;
      if (this.desloc !== 0) {
        const i = this.atrasoA; this.atrasoA = this.a(agudo);
        const q = this.b(agudo);
        this.fase += w; if (this.fase > 6.283185307179586) this.fase -= 6.283185307179586;
        y = grave + i * Math.cos(this.fase) + q * Math.sin(this.fase);
      }
      // 3) Expansor (pelo sinal já limpo do retorno).
      const ax = Math.abs(grave + agudo);
      this.env += (ax > this.env ? this.kAtaque : this.kSolta) * (ax - this.env);
      this.piso += (this.env > this.piso ? this.kPisoSobe : this.kPisoDesce) * (this.env - this.piso);
      let alvo = 1;
      if (this.expansor) {
        const limiar = Math.min(0.05, Math.max(0.004, this.piso * 3.2));
        if (this.env >= limiar) this.segura = this.seguraN;
        else if (this.segura > 0) this.segura--;
        else alvo = 0.25;
      }
      this.g += (alvo > this.g ? this.kAbre : this.kFecha) * (alvo - this.g);
      // 4) Volume e limitador.
      this.ganho += this.kGanho * (this.ganhoAlvo - this.ganho);
      const saida = limitar(y * this.g * this.ganho);
      sai[n] = saida;
      // Referência do cancelador: os agudos do que saiu (mesma divisão de bandas do microfone).
      const rg = this.rl2(this.rl1(saida));
      ref[this.pos & MASCARA] = saida - rg;
      this.pos = (this.pos + 1) & 0x3fffffff;
    }
    if (usarAfc && (this.cont += sai.length) >= 8192) { this.cont = 0; this.recalcular(); }
    if ((this.cont2 = (this.cont2 || 0) + sai.length) >= Math.round(sampleRate / 2)) {
      this.cont2 = 0;
      const erle = usarAfc && this.pe > 0 && this.px > 1e-10 ? 10 * Math.log10(this.px / this.pe) : null;
      this.port.postMessage({ afc: { ativo: usarAfc, erle, resets: this.reset, atraso: this.atraso } });
    }
    return true;
  }
}
registerProcessor('karaoke-monitor', Monitor);
`;

/**
 * Segundo getUserMedia do MESMO microfone, cru (sem eco, ruído nem ganho automático, buffer mínimo), só para a Voz na TV: o AEC do Chrome
 * atrasa e filtra o sinal. O detector de tom e a gravação seguem no stream com AEC. Devolve null se o Chrome não der uma faixa realmente
 * diferente (aí a monitoração usa o mesmo stream, para a nota nunca depender da monitoração).
 */
async function abrirMicCru(id: string | null): Promise<MediaStream | null> {
  const cru = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 1 }, latency: { ideal: 0 } };
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: id ? { ...cru, deviceId: { exact: id } } : cru });
    if (s.getAudioTracks()[0]?.getSettings().echoCancellation === false) return s;
    s.getTracks().forEach((t) => t.stop());
    return null;
  } catch { return null; }
}

/** Curva do limitador: reta (ganho 1) até 0,6 e joelho suave (tanh) até 1. */
export function limitar(x: number): number {
  const a = Math.abs(x);
  return a <= 0.6 ? x : Math.sign(x) * (0.6 + 0.4 * Math.tanh((a - 0.6) / 0.4));
}

const CHAVE_ATRASO = 'karaoke_afc_atraso_';
function lerAtrasoSalvo(id: string | null): number | null {
  try { const n = Number(window.localStorage.getItem(CHAVE_ATRASO + (id || 'padrao'))); return Number.isFinite(n) && n > 1 && n < 1000 ? n : null; } catch { return null; }
}
function gravarAtrasoSalvo(id: string | null, ms: number) {
  try { window.localStorage.setItem(CHAVE_ATRASO + (id || 'padrao'), String(ms)); } catch { /* só conveniência */ }
}

const SEM_VOZ: Vivo = { midi: null, hz: 0, rms: 0, cantando: false, limiar: limiarDeVoz(0) };

function mensagemDeErro(err: unknown): string {
  const nome = (err as { name?: string })?.name;
  if (nome === 'NotAllowedError' || nome === 'SecurityError') return 'O navegador bloqueou o microfone. Libere nas permissões do site e tente de novo.';
  if (nome === 'NotFoundError') return 'Nenhum microfone encontrado. Confira se o USB está conectado.';
  if (nome === 'NotReadableError') return 'O microfone está em uso por outro programa.';
  return 'Não consegui abrir o microfone.';
}

export function useAfinacao(deviceId: string | null, opcoes: { vozNaTv?: boolean; volumeVoz?: number; cancelarEco?: boolean; aoRetorno?: (mensagem: string) => void } = {}) {
  const { vozNaTv = false, volumeVoz = 0.8, cancelarEco = false } = opcoes;
  const [status, setStatus] = useState<StatusMic>('parado');
  const [erro, setErro] = useState('');
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [ativoId, setAtivoId] = useState<string | null>(null);
  /** O que o navegador confirmou em track.getSettings().echoCancellation (null: não informou ou microfone fechado). */
  const [ecoAtivo, setEcoAtivo] = useState<boolean | null>(null);
  const [antiMic, setAntiMic] = useState<EstadoAntiMic>({ cortes: 0, reducaoDb: 0, avisos: 0 });
  const [infoMonitor, setInfoMonitor] = useState<InfoMonitor | null>(null);
  const [infoAfc, setInfoAfc] = useState<InfoAfc | null>(null);
  const ecoPedido = useRef(cancelarEco);
  const aoRetornoRef = useRef(opcoes.aoRetorno);
  /** Peças da anti-microfonia do microfone aberto (só no caminho da Voz na TV; o detector de tom e a gravação recebem o sinal limpo do microfone). */
  const anti = useRef<{ gerente: GerenciadorMicrofonia; detector: DetectorMicrofonia; cortes: BiquadFilterNode[]; reducaoDb: number; avisos: number; eventos: number } | null>(null);
  /** Leitura atual (altura, volume). Muda a 30 vezes por segundo: por isso é ref e não estado. */
  const vivo = useRef<Vivo>(SEM_VOZ);
  /** Últimos segundos de altura, para o medidor desenhar a linha rolando. */
  const historico = useRef<PontoAltura[]>([]);
  const audio = useRef<{ ctx?: AudioContext; stream?: MediaStream; timer?: number; node?: AudioWorkletNode; vozGain?: GainNode; timerAnti?: number; timerInfo?: number; ctxMon?: AudioContext; streamMon?: MediaStream; fonteMon?: MediaStreamAudioSourceNode; monitorNode?: AudioWorkletNode; medidaPronta?: boolean; afinando?: boolean; token: number }>({ token: 0 });
  const gravacao = useRef<{ ativa: boolean; pausada: boolean; t0: number; quadros: Quadro[]; limiar: number; ruido: number; posicao?: () => number }>({ ativa: false, pausada: false, t0: 0, quadros: [], limiar: 0, ruido: 0 });
  /** Quem recebe cada quadro gravado (pontuação ao vivo e plateia). limiar: o de voz valendo nesse instante. */
  const ouvinte = useRef<((q: Quadro, limiar: number, ruido: number) => void) | null>(null);
  /** Modo estúdio: clareza mínima e limiar de voz próprios (a voz cantada real tem clareza menor e a música da TV vaza para o microfone). */
  const estudio = useRef(false);
  /** Taxa de amostragem e latências do AudioContext do microfone (depuração). */
  const infoAudio = useRef({ sampleRate: 0, baseLatency: 0, outputLatency: 0 });
  const voz = useRef({ ligada: vozNaTv, volume: volumeVoz });
  const idPedido = useRef(deviceId);

  const listar = useCallback(async () => {
    try {
      const todos = await navigator.mediaDevices.enumerateDevices();
      setDispositivos(todos.filter((d) => d.kind === 'audioinput' && d.deviceId).map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microfone ${i + 1}` })));
    } catch { /* lista é só conveniência */ }
  }, []);

  const parar = useCallback(() => {
    const a = audio.current;
    a.token++;
    if (a.timer !== undefined) window.clearInterval(a.timer);
    a.timer = undefined;
    if (a.timerAnti !== undefined) window.clearInterval(a.timerAnti);
    a.timerAnti = undefined;
    if (a.timerInfo !== undefined) window.clearInterval(a.timerInfo);
    a.timerInfo = undefined;
    anti.current = null;
    setInfoMonitor(null);
    setInfoAfc(null);
    setAntiMic((x) => (x.cortes || x.reducaoDb ? { ...x, cortes: 0, reducaoDb: 0 } : x));
    if (a.node) { a.node.port.onmessage = null; a.node.disconnect(); }
    a.node = undefined;
    a.stream?.getTracks().forEach((t) => t.stop());
    if (a.streamMon && a.streamMon !== a.stream) a.streamMon.getTracks().forEach((t) => t.stop());
    void a.ctx?.close().catch(() => undefined);
    void a.ctxMon?.close().catch(() => undefined);
    a.stream = undefined; a.ctx = undefined; a.vozGain = undefined;
    a.ctxMon = undefined; a.streamMon = undefined; a.fonteMon = undefined; a.monitorNode = undefined; a.medidaPronta = undefined; a.afinando = undefined;
    vivo.current = SEM_VOZ;
    historico.current = [];
  }, []);

  /** Aplica o ganho da voz na TV: volume escolhido menos a redução da anti-microfonia; zero com a Voz na TV desligada. */
  const aplicarVolume = useCallback(() => {
    const g = audio.current.vozGain;
    const ctx = audio.current.ctxMon;
    if (!g || !ctx) return;
    const reducao = anti.current?.reducaoDb ?? 0;
    const alvo = voz.current.ligada ? voz.current.volume * Math.pow(10, -reducao / 20) : 0;
    // Com o worklet, o volume é aplicado lá dentro (a referência do cancelador precisa ser o som que sai de fato).
    const mon = audio.current.monitorNode;
    if (mon) { mon.port.postMessage({ ganho: alvo }); g.gain.setValueAtTime(1, ctx.currentTime); }
    else g.gain.setTargetAtTime(alvo, ctx.currentTime, 0.03);
  }, []);

  const abrir = useCallback(async (id: string | null) => {
    if (!navigator.mediaDevices?.getUserMedia) { setErro('Este navegador não libera o microfone nesta página (precisa de HTTPS).'); setStatus('erro'); return; }
    parar();
    const token = audio.current.token;
    setStatus('abrindo'); setErro('');
    // Cancelamento de eco do Chrome (usa como referência o que o próprio Chrome toca); ruído e ganho automáticos estragam voz cantada.
    const base = { echoCancellation: ecoPedido.current, noiseSuppression: false, autoGainControl: false, channelCount: 1 };
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: id ? { ...base, deviceId: { exact: id } } : base });
      } catch (e) {
        const nome = (e as { name?: string })?.name;
        if (id && (nome === 'OverconstrainedError' || nome === 'NotFoundError')) stream = await navigator.mediaDevices.getUserMedia({ audio: base });
        else throw e;
      }
      if (token !== audio.current.token) { stream.getTracks().forEach((t) => t.stop()); return; }
      const ctx = new AudioContext({ latencyHint: 'interactive' });
      await ctx.resume().catch(() => undefined);
      if (token !== audio.current.token) { stream.getTracks().forEach((t) => t.stop()); void ctx.close().catch(() => undefined); return; }
      setEcoAtivo(typeof stream.getAudioTracks()[0]?.getSettings().echoCancellation === 'boolean' ? Boolean(stream.getAudioTracks()[0]?.getSettings().echoCancellation) : null);
      infoAudio.current = { sampleRate: ctx.sampleRate, baseLatency: ctx.baseLatency ?? 0, outputLatency: ctx.outputLatency ?? 0 };
      const fonte = ctx.createMediaStreamSource(stream);
      const analisador = ctx.createAnalyser();
      analisador.fftSize = 2048;
      fonte.connect(analisador);

      // ----- Voz na TV (monitoração) -----
      // Contexto próprio com o menor buffer que o hardware aceitar (latencyHint 0) e a taxa do próprio microfone (sem reamostrar), fonte crua
      // (segundo getUserMedia, sem AEC). Cadeia: microfone -> passa-altas -> cortes anti-microfonia -> limitador tanh -> ganho -> caixas (e reverb curto).
      // Nada aqui atrasa o sinal seco: filtros Biquad e WaveShaper (sem oversample) são IIR/instantâneos e o Convolver só soma a cauda do reverb.
      // Sem porta de ruído no caminho (ela abria pela thread principal e comia o começo das palavras); o AudioWorklet de captura e os
      // analisadores ficam fora do caminho das caixas.
      const crua = await abrirMicCru(stream.getAudioTracks()[0]?.getSettings().deviceId ?? id);
      if (token !== audio.current.token) { crua?.getTracks().forEach((t) => t.stop()); stream.getTracks().forEach((t) => t.stop()); void ctx.close().catch(() => undefined); return; }
      const streamMon = crua ?? stream;
      const taxaMon = streamMon.getAudioTracks()[0]?.getSettings().sampleRate;
      let ctxMon: AudioContext;
      try { ctxMon = new AudioContext({ latencyHint: 0, ...(taxaMon ? { sampleRate: taxaMon } : {}) }); } catch { ctxMon = new AudioContext({ latencyHint: 0 }); }
      await ctxMon.resume().catch(() => undefined);
      if (token !== audio.current.token) { crua?.getTracks().forEach((t) => t.stop()); stream.getTracks().forEach((t) => t.stop()); void ctx.close().catch(() => undefined); void ctxMon.close().catch(() => undefined); return; }
      const fonteMon = ctxMon.createMediaStreamSource(streamMon);
      const passaAltas = ctxMon.createBiquadFilter();
      passaAltas.type = 'highpass';
      passaAltas.frequency.value = 120;
      passaAltas.Q.value = 0.707;
      const cortes = Array.from({ length: MAX_CORTES }, () => {
        const f = ctxMon.createBiquadFilter();
        f.type = 'peaking'; // ganho negativo = corte estreito (notch com profundidade ajustável)
        f.frequency.value = 1000;
        f.Q.value = Q_CORTE;
        f.gain.value = 0;
        return f;
      });
      // Limitador sem atraso: curva suave em vez de DynamicsCompressor, que segura ~6 ms de antecipação. Ganho 1 no sinal baixo (a curva
      // tanh(1,6x) normalizada antiga somava 4,8 dB e deixava o laço caixa-microfone mais perto de apitar).
      const limitador = ctxMon.createWaveShaper();
      const curva = new Float32Array(1024);
      for (let i = 0; i < curva.length; i++) { const x = (i / (curva.length - 1)) * 2 - 1; curva[i] = limitar(x); }
      limitador.curve = curva;
      const vozGain = ctxMon.createGain();
      vozGain.gain.value = voz.current.ligada ? voz.current.volume : 0;
      const reverb = ctxMon.createConvolver();
      // Eco de karaokê curto e discreto: reverb longo soa como atraso e atrapalha quem canta.
      reverb.buffer = criarImpulso(ctxMon, 0.5, 4);
      const reverbGain = ctxMon.createGain();
      reverbGain.gain.value = 0.08;
      // Deslocador de frequência e expansor (AudioWorklet). Se o navegador não carregar, a cadeia segue sem ele.
      let monitorNode: AudioWorkletNode | undefined;
      try {
        if (!ctxMon.audioWorklet) throw new Error('sem AudioWorklet');
        const url = URL.createObjectURL(new Blob([CODIGO_MONITOR], { type: 'text/javascript' }));
        try { await ctxMon.audioWorklet.addModule(url); } finally { URL.revokeObjectURL(url); }
        monitorNode = new AudioWorkletNode(ctxMon, 'karaoke-monitor', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 1, channelCountMode: 'explicit' });
      } catch { monitorNode = undefined; }
      if (token !== audio.current.token) { crua?.getTracks().forEach((t) => t.stop()); stream.getTracks().forEach((t) => t.stop()); void ctx.close().catch(() => undefined); void ctxMon.close().catch(() => undefined); return; }
      fonteMon.connect(passaAltas);
      let cadeia: AudioNode = passaAltas;
      for (const c of cortes) { cadeia.connect(c); cadeia = c; }
      if (monitorNode) {
        // Volume e limitador ficam dentro do worklet; o GainNode fica em 1 só para manter a ligação com o reverb.
        cadeia.connect(monitorNode);
        monitorNode.connect(vozGain);
        vozGain.gain.value = 1;
        monitorNode.port.postMessage({ ganho: voz.current.ligada ? voz.current.volume : 0 });
        monitorNode.port.onmessage = (e: MessageEvent<{ afc?: InfoAfc }>) => { const n = e.data?.afc; if (n) setInfoAfc((x) => (x && x.ativo === n.ativo && x.resets === n.resets && x.erle !== null && n.erle !== null && Math.abs(x.erle - n.erle) < 0.5 ? x : n)); };
        const salvo = lerAtrasoSalvo(stream.getAudioTracks()[0]?.getSettings().deviceId ?? id);
        if (salvo) monitorNode.port.postMessage({ atraso: (salvo / 1000) * ctxMon.sampleRate });
      } else {
        cadeia.connect(limitador);
        limitador.connect(vozGain);
      }
      vozGain.connect(ctxMon.destination);
      vozGain.connect(reverb);
      reverb.connect(reverbGain);
      reverbGain.connect(ctxMon.destination);

      const lerInfo = (): InfoMonitor => ({
        taxa: ctxMon.sampleRate,
        baseMs: Math.round((ctxMon.baseLatency ?? 0) * 10000) / 10,
        saidaMs: Math.round((ctxMon.outputLatency ?? 0) * 10000) / 10,
        separado: Boolean(crua),
        eco: typeof streamMon.getAudioTracks()[0]?.getSettings().echoCancellation === 'boolean' ? Boolean(streamMon.getAudioTracks()[0]?.getSettings().echoCancellation) : null,
      });
      setInfoMonitor(lerInfo());
      const timerInfo = window.setInterval(() => {
        const n = lerInfo();
        setInfoMonitor((x) => (x && x.taxa === n.taxa && x.baseMs === n.baseMs && x.saidaMs === n.saidaMs && x.separado === n.separado && x.eco === n.eco ? x : n));
      }, 2000);

      // Vigia do retorno (~30x por segundo, só com a Voz na TV ligada): detector de microfonia adaptativo. Só analisa, não está no caminho do som.
      const analisadorRetorno = ctxMon.createAnalyser();
      analisadorRetorno.fftSize = 4096;
      analisadorRetorno.smoothingTimeConstant = 0;
      passaAltas.connect(analisadorRetorno);
      const espectro = new Float32Array(analisadorRetorno.frequencyBinCount);
      const pecas = { gerente: new GerenciadorMicrofonia(), detector: new DetectorMicrofonia({ sampleRate: ctxMon.sampleRate, fftSize: analisadorRetorno.fftSize }), cortes, reducaoDb: 0, avisos: 0, eventos: 0 };
      anti.current = pecas;
      let vigiaLigada = false;
      let ultimaSoltura = 0;
      const vigia = window.setInterval(() => {
        if (!voz.current.ligada) { vigiaLigada = false; return; }
        if (!vigiaLigada) { vigiaLigada = true; pecas.detector.reiniciar(); }
        // Microfonia: pico estreito parado numa frequência que persiste ou cresce vira um corte; sem recurso, baixa a voz.
        const agora = performance.now();
        // Uma vez por segundo: solta os cortes que não apitam há 60 s e devolve aos poucos o volume que tinha sido abaixado.
        if (agora - ultimaSoltura >= 1000 && !audio.current.afinando) {
          ultimaSoltura = agora;
          let mudou = false;
          for (const acao of pecas.gerente.soltar(agora)) {
            mudou = true;
            if (acao.tipo === 'cortar') pecas.cortes[acao.indice].gain.setTargetAtTime(acao.ganhoDb, ctxMon.currentTime, 0.3);
            else { pecas.reducaoDb = acao.totalDb; aplicarVolume(); }
          }
          if (mudou) setAntiMic({ cortes: pecas.gerente.estado().cortes.length, reducaoDb: pecas.reducaoDb, avisos: pecas.avisos });
        }
        analisadorRetorno.getFloatFrequencyData(espectro);
        const det = pecas.detector.analisar(espectro, agora);
        if (!det) return;
        pecas.eventos++;
        for (const acao of pecas.gerente.aoDetectar(det, agora)) {
          if (acao.tipo === 'cortar') {
            const f = pecas.cortes[acao.indice];
            f.frequency.setValueAtTime(acao.hz, ctxMon.currentTime);
            f.Q.setValueAtTime(acao.q, ctxMon.currentTime);
            f.gain.setTargetAtTime(acao.ganhoDb, ctxMon.currentTime, 0.02);
          } else {
            pecas.reducaoDb = acao.totalDb;
            pecas.avisos++;
            aplicarVolume();
            if (!audio.current.afinando) aoRetornoRef.current?.(AVISO_RETORNO);
          }
        }
        const e = pecas.gerente.estado();
        setAntiMic({ cortes: e.cortes.length, reducaoDb: pecas.reducaoDb, avisos: pecas.avisos });
      }, 33);

      const janelaN = analisador.fftSize;
      const buf = new Float32Array(janelaN);
      const detector = PitchDetector.forFloat32Array(janelaN);
      let recentes: number[] = [];
      let semVoz = 0;
      /**
       * Mede um quadro (janela de 2048 amostras). idadeMs: há quanto tempo esse trecho foi captado. Com a captura pelo AudioWorklet os quadros
       * chegam em fila mesmo se a página travar (câmera, canvas pesado), então o tempo e a posição da música são os do instante da captura.
       */
      const processar = (janela: Float32Array, idadeMs: number) => {
        let soma = 0;
        for (let i = 0; i < janela.length; i++) soma += janela[i] * janela[i];
        const rms = Math.sqrt(soma / janela.length);
        let hz = 0;
        let clareza = 0;
        if (rms > 0.004) [hz, clareza] = detector.findPitch(janela, ctx.sampleRate);
        const agora = performance.now() - idadeMs;
        const g = gravacao.current;
        if (g.ativa && !g.pausada && agora >= g.t0) {
          const quadro: Quadro = g.posicao ? { t: agora - g.t0, hz, clareza, rms, m: g.posicao() - idadeMs } : { t: agora - g.t0, hz, clareza, rms };
          g.quadros.push(quadro);
          if (!g.limiar && agora - g.t0 >= 2000) { g.ruido = medirRuido(g.quadros); g.limiar = limiarDeVoz(g.ruido); }
          ouvinte.current?.(quadro, g.limiar || limiarDeVoz(0), g.ruido);
        }
        const limiar = estudio.current ? limiarDeVozEstudio(g.ruido) : g.limiar || limiarDeVoz(0);
        const valido = clareza >= (estudio.current ? CLAREZA_ESTUDIO : CLAREZA_MINIMA) && rms > limiar && hz >= HZ_MIN && hz <= HZ_MAX;
        let midi: number | null = null;
        if (valido) {
          recentes.push(hzParaMidi(hz));
          if (recentes.length > 3) recentes.shift();
          midi = [...recentes].sort((a, b) => a - b)[Math.floor(recentes.length / 2)];
          semVoz = 0;
        } else if (++semVoz > 3) recentes = [];
        vivo.current = { midi, hz: valido ? hz : 0, rms, cantando: valido, limiar };
        const h = historico.current;
        h.push({ t: agora, midi });
        const corte = performance.now() - 12000;
        while (h.length && h[0].t < corte) h.shift();
      };

      // Captura no thread de áudio (AudioWorklet): um quadro a cada ~33 ms, com o instante exato. Sem worklet, cai no temporizador.
      let timer: number | undefined;
      let node: AudioWorkletNode | undefined;
      const largar = () => {
        if (timer !== undefined) window.clearInterval(timer);
        window.clearInterval(vigia);
        window.clearInterval(timerInfo);
        if (node) { node.port.onmessage = null; node.disconnect(); }
        stream.getTracks().forEach((t) => t.stop());
        if (streamMon !== stream) streamMon.getTracks().forEach((t) => t.stop());
        void ctx.close().catch(() => undefined);
        void ctxMon.close().catch(() => undefined);
        if (anti.current === pecas) anti.current = null;
      };
      try {
        if (!ctx.audioWorklet) throw new Error('sem AudioWorklet');
        const url = URL.createObjectURL(new Blob([CODIGO_CAPTURA], { type: 'text/javascript' }));
        try { await ctx.audioWorklet.addModule(url); } finally { URL.revokeObjectURL(url); }
        if (token !== audio.current.token) { largar(); return; }
        node = new AudioWorkletNode(ctx, 'karaoke-captura', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], processorOptions: { janela: janelaN, passo: Math.round(ctx.sampleRate * 0.033) } });
        node.port.onmessage = (e: MessageEvent<{ t: number; buf: Float32Array }>) => processar(e.data.buf, Math.max(0, (ctx.currentTime - e.data.t) * 1000));
        const mudo = ctx.createGain();
        mudo.gain.value = 0;
        fonte.connect(node);
        node.connect(mudo);
        mudo.connect(ctx.destination);
      } catch {
        if (token !== audio.current.token) { largar(); return; }
        node = undefined;
        timer = window.setInterval(() => { analisador.getFloatTimeDomainData(buf); processar(buf, 0); }, 33);
      }
      if (token !== audio.current.token) { largar(); return; }

      audio.current = { ctx, stream, timer, node, vozGain, timerAnti: vigia, timerInfo, ctxMon, streamMon, fonteMon, monitorNode, token };
      setAtivoId(stream.getAudioTracks()[0]?.getSettings().deviceId ?? id);
      setStatus('ativo');
      void listar();
    } catch (e) {
      if (token === audio.current.token) { setErro(mensagemDeErro(e)); setStatus('erro'); }
    }
  }, [listar, parar, aplicarVolume]);

  // Volume e liga/desliga da voz na TV (menos a redução que a anti-microfonia aplicou).
  useEffect(() => {
    voz.current = { ligada: vozNaTv, volume: volumeVoz };
    aplicarVolume();
  }, [vozNaTv, volumeVoz, aplicarVolume]);

  // Mudou o cancelamento de eco com o microfone ligado: reabre para o navegador aplicar a nova configuração.
  const ecoAnterior = useRef(cancelarEco);
  useEffect(() => {
    aoRetornoRef.current = opcoes.aoRetorno;
    if (ecoAnterior.current === cancelarEco) return;
    ecoAnterior.current = cancelarEco;
    ecoPedido.current = cancelarEco;
    if (audio.current.stream) void abrir(idPedido.current);
  });

  // Trocou o dispositivo escolhido com o microfone ligado: reabre nele.
  useEffect(() => {
    if (idPedido.current === deviceId) return;
    idPedido.current = deviceId;
    if (audio.current.stream && deviceId !== ativoId) void abrir(deviceId);
  }, [deviceId, ativoId, abrir]);

  useEffect(() => {
    const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    if (!md?.addEventListener) return;
    const aoMudar = () => void listar();
    md.addEventListener('devicechange', aoMudar);
    return () => md.removeEventListener('devicechange', aoMudar);
  }, [listar]);

  useEffect(() => parar, [parar]);

  const retomar = useCallback(() => { void audio.current.ctx?.resume().catch(() => undefined); void audio.current.ctxMon?.resume().catch(() => undefined); }, []);
  const ligar = useCallback(() => abrir(idPedido.current), [abrir]);
  const desligar = useCallback(() => { parar(); setStatus('parado'); }, [parar]);

  /** Começa a guardar os quadros (chamar quando a música começa a tocar). posicao: ms atuais do vídeo, para casar a voz com a letra. */
  const iniciarGravacao = useCallback((posicao?: () => number) => {
    gravacao.current = { ativa: true, pausada: false, t0: performance.now(), quadros: [], limiar: 0, ruido: 0, posicao };
  }, []);
  const pausarGravacao = useCallback((pausada: boolean) => { gravacao.current.pausada = pausada; }, []);
  const pararGravacao = useCallback((): Quadro[] => {
    const q = gravacao.current.quadros;
    gravacao.current = { ativa: false, pausada: false, t0: 0, quadros: [], limiar: 0, ruido: 0 };
    return q;
  }, []);

  /** Fluxo do microfone aberto (para o gravador dos melhores momentos misturar a voz), ou undefined se desligado. */
  const obterStream = useCallback((): MediaStream | undefined => audio.current.stream, []);

  /**
   * Mede o atraso total da Voz na TV: 3 pulsos pelas caixas, gravados pelo microfone cru; mediana dos picos achados por correlação.
   * A Voz na TV é silenciada durante a medição (senão o próprio pulso voltaria pelo retorno e confundiria o pico).
   */
  const medirAtraso = useCallback(async (): Promise<ResultadoAtraso> => {
    const a = audio.current;
    const ctx = a.ctxMon;
    const fonte = a.fonteMon;
    if (!ctx || !fonte) throw new Error('Ligue o microfone antes de medir.');
    await ctx.resume().catch(() => undefined);
    if (!a.medidaPronta) {
      const url = URL.createObjectURL(new Blob([CODIGO_MEDIDA], { type: 'text/javascript' }));
      try { await ctx.audioWorklet.addModule(url); } finally { URL.revokeObjectURL(url); }
      a.medidaPronta = true;
    }
    const node = new AudioWorkletNode(ctx, 'karaoke-medida', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    const mudo = ctx.createGain();
    mudo.gain.value = 0;
    fonte.connect(node);
    node.connect(mudo);
    mudo.connect(ctx.destination);
    const pulso = gerarPulso(ctx.sampleRate);
    const buffer = ctx.createBuffer(1, pulso.length, ctx.sampleRate);
    buffer.copyToChannel(pulso, 0);
    const ganhoPulso = ctx.createGain();
    ganhoPulso.gain.value = 0.8;
    ganhoPulso.connect(ctx.destination);
    const vozAntes = voz.current.ligada;
    voz.current.ligada = false;
    aplicarVolume();
    const medidas: number[] = [];
    const razoes: number[] = [];
    let falhas = 0;
    try {
      for (let i = 0; i < 3; i++) {
        const captura = new Promise<{ t0: number; buf: Float32Array } | null>((resolve) => {
          const limite = window.setTimeout(() => resolve(null), 3000);
          node.port.onmessage = (e: MessageEvent<{ t0: number; buf: Float32Array }>) => { window.clearTimeout(limite); resolve(e.data); };
        });
        node.port.postMessage({ tipo: 'gravar', amostras: Math.round(ctx.sampleRate * 0.7) });
        const t0Pulso = ctx.currentTime + 0.2;
        const fontePulso = ctx.createBufferSource();
        fontePulso.buffer = buffer;
        fontePulso.connect(ganhoPulso);
        fontePulso.start(t0Pulso);
        const r = await captura;
        const achado = r ? acharPulso(r.buf, pulso) : null;
        if (r && achado) { medidas.push((r.t0 + achado.indice / ctx.sampleRate - t0Pulso) * 1000); razoes.push(Math.round(achado.razao * 10) / 10); }
        else falhas++;
        await new Promise((res) => window.setTimeout(res, 250));
      }
    } finally {
      node.port.onmessage = null;
      node.disconnect();
      mudo.disconnect();
      ganhoPulso.disconnect();
      voz.current.ligada = vozAntes;
      aplicarVolume();
    }
    const validas = medidas.filter((x) => x > 0);
    const m = medianaDeAtrasos(validas);
    const inconsistente = m !== null && !medicoesConsistentes(validas);
    // Atraso confiável: liga o cancelador adaptativo com ele e guarda para a próxima vez (por microfone).
    if (m !== null && !inconsistente) {
      a.monitorNode?.port.postMessage({ atraso: (m / 1000) * ctx.sampleRate });
      gravarAtrasoSalvo(a.stream?.getAudioTracks()[0]?.getSettings().deviceId ?? null, m);
    }
    return { atrasoMs: m === null || inconsistente ? null : Math.round(m * 10) / 10, medidas: medidas.map((x) => Math.round(x * 10) / 10), falhas, inconsistente, razoes };
  }, [aplicarVolume]);

  /**
   * Afinar microfonia (ring-out, como os técnicos de som fazem antes do show): com a sala em silêncio, sobe a Voz na TV 1,5 dB a cada
   * 250 ms. Cada apito vira um corte fixo (o detector faz isso) e o volume recua 4 dB antes de continuar. Para no 5o apito ou no volume
   * máximo. Devolve o volume seguro (6 dB abaixo do último apito) e quantos cortes ficaram.
   */
  const afinarRetorno = useCallback(async (aoPasso?: (volume: number, apitos: number) => void): Promise<{ volumeSeguro: number; apitos: number; cortes: number }> => {
    const a = audio.current;
    const p = anti.current;
    if (!a.ctxMon || !a.vozGain || !p) throw new Error('Ligue o microfone antes de afinar.');
    if (a.afinando) throw new Error('A afinação já está rodando.');
    await a.ctxMon.resume().catch(() => undefined);
    const antes = { ...voz.current };
    const token = a.token;
    a.afinando = true;
    a.monitorNode?.port.postMessage({ expansor: false });
    const dB = (x: number) => Math.pow(10, x / 20);
    const espera = (ms: number) => new Promise((res) => window.setTimeout(res, ms));
    let v = 0.1;
    let ultimoApito: number | null = null;
    let apitos = 0;
    let eventos = p.eventos;
    try {
      while (apitos < 5 && token === audio.current.token) {
        voz.current = { ligada: true, volume: v };
        p.reducaoDb = 0;
        p.gerente.zerarReducao();
        aplicarVolume();
        aoPasso?.(v, apitos);
        await espera(250);
        if (p.eventos > eventos) {
          apitos++;
          ultimoApito = Math.min(ultimoApito ?? Infinity, v);
          v = Math.max(0.05, v / dB(4));
          voz.current = { ligada: true, volume: v };
          aplicarVolume();
          await espera(700);
          eventos = p.eventos;
          continue;
        }
        if (v >= 1) break;
        v = Math.min(1, v * dB(1.5));
      }
    } finally {
      p.gerente.fixarCortes();
      a.monitorNode?.port.postMessage({ expansor: true });
      p.reducaoDb = 0;
      p.gerente.zerarReducao();
      voz.current = antes;
      a.afinando = false;
      aplicarVolume();
      const e = p.gerente.estado();
      setAntiMic({ cortes: e.cortes.length, reducaoDb: 0, avisos: p.avisos });
    }
    const volumeSeguro = ultimoApito === null ? 1 : Math.max(0.1, Math.min(1, ultimoApito / dB(6)));
    return { volumeSeguro: Math.round(volumeSeguro * 100) / 100, apitos, cortes: p.gerente.estado().cortes.length };
  }, [aplicarVolume]);

  /** Cortes ativos (frequência e profundidade) e redução de ganho, ou null com o microfone fechado (depuração). */
  const lerAntiMic = useCallback(() => { const p = anti.current; return p ? { ...p.gerente.estado(), reducaoDb: p.reducaoDb } : null; }, []);

  /** Zera os cortes e a redução de ganho da anti-microfonia. */
  const resetarAntiMicrofonia = useCallback(() => {
    const p = anti.current;
    const ctx = audio.current.ctxMon;
    if (!p || !ctx) return;
    p.gerente.reiniciar();
    p.detector.reiniciar();
    p.reducaoDb = 0;
    for (const f of p.cortes) f.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
    aplicarVolume();
    setAntiMic((x) => ({ ...x, cortes: 0, reducaoDb: 0 }));
  }, [aplicarVolume]);

  const definirOuvinte = useCallback((fn: ((q: Quadro, limiar: number, ruido: number) => void) | null) => { ouvinte.current = fn; }, []);
  const definirModoEstudio = useCallback((ligado: boolean) => { estudio.current = ligado; }, []);

  return { infoAfc, infoMonitor, afinarRetorno, medirAtraso, lerAntiMic, ecoAtivo, antiMic, resetarAntiMicrofonia, infoAudio, definirOuvinte, definirModoEstudio, obterStream, status, erro, dispositivos, ativoId, vivo, historico, ligar, desligar, retomar, listar, iniciarGravacao, pausarGravacao, pararGravacao };
}
