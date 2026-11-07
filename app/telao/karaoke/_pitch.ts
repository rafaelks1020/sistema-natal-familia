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
  const ecoPedido = useRef(cancelarEco);
  const aoRetornoRef = useRef(opcoes.aoRetorno);
  /** Peças da anti-microfonia do microfone aberto (só no caminho da Voz na TV; o detector de tom e a gravação recebem o sinal limpo do microfone). */
  const anti = useRef<{ gerente: GerenciadorMicrofonia; detector: DetectorMicrofonia; cortes: BiquadFilterNode[]; reducaoDb: number; avisos: number } | null>(null);
  /** Leitura atual (altura, volume). Muda a 30 vezes por segundo: por isso é ref e não estado. */
  const vivo = useRef<Vivo>(SEM_VOZ);
  /** Últimos segundos de altura, para o medidor desenhar a linha rolando. */
  const historico = useRef<PontoAltura[]>([]);
  const audio = useRef<{ ctx?: AudioContext; stream?: MediaStream; timer?: number; node?: AudioWorkletNode; vozGain?: GainNode; timerAnti?: number; timerInfo?: number; ctxMon?: AudioContext; streamMon?: MediaStream; fonteMon?: MediaStreamAudioSourceNode; medidaPronta?: boolean; token: number }>({ token: 0 });
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
    setAntiMic((x) => (x.cortes || x.reducaoDb ? { ...x, cortes: 0, reducaoDb: 0 } : x));
    if (a.node) { a.node.port.onmessage = null; a.node.disconnect(); }
    a.node = undefined;
    a.stream?.getTracks().forEach((t) => t.stop());
    if (a.streamMon && a.streamMon !== a.stream) a.streamMon.getTracks().forEach((t) => t.stop());
    void a.ctx?.close().catch(() => undefined);
    void a.ctxMon?.close().catch(() => undefined);
    a.stream = undefined; a.ctx = undefined; a.vozGain = undefined;
    a.ctxMon = undefined; a.streamMon = undefined; a.fonteMon = undefined; a.medidaPronta = undefined;
    vivo.current = SEM_VOZ;
    historico.current = [];
  }, []);

  /** Aplica o ganho da voz na TV: volume escolhido menos a redução da anti-microfonia; zero com a Voz na TV desligada. */
  const aplicarVolume = useCallback(() => {
    const g = audio.current.vozGain;
    const ctx = audio.current.ctxMon;
    if (!g || !ctx) return;
    const reducao = anti.current?.reducaoDb ?? 0;
    g.gain.setTargetAtTime(voz.current.ligada ? voz.current.volume * Math.pow(10, -reducao / 20) : 0, ctx.currentTime, 0.03);
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
      // Limitador sem atraso: curva suave (tanh) em vez de DynamicsCompressor, que segura ~6 ms de antecipação.
      const limitador = ctxMon.createWaveShaper();
      const curva = new Float32Array(1024);
      for (let i = 0; i < curva.length; i++) { const x = (i / (curva.length - 1)) * 2 - 1; curva[i] = Math.tanh(x * 1.6) / Math.tanh(1.6); }
      limitador.curve = curva;
      const vozGain = ctxMon.createGain();
      vozGain.gain.value = voz.current.ligada ? voz.current.volume : 0;
      const reverb = ctxMon.createConvolver();
      // Eco de karaokê curto e discreto: reverb longo soa como atraso e atrapalha quem canta.
      reverb.buffer = criarImpulso(ctxMon, 0.5, 4);
      const reverbGain = ctxMon.createGain();
      reverbGain.gain.value = 0.12;
      fonteMon.connect(passaAltas);
      let cadeia: AudioNode = passaAltas;
      for (const c of cortes) { cadeia.connect(c); cadeia = c; }
      cadeia.connect(limitador);
      limitador.connect(vozGain);
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
      const pecas = { gerente: new GerenciadorMicrofonia(), detector: new DetectorMicrofonia({ sampleRate: ctxMon.sampleRate, fftSize: analisadorRetorno.fftSize }), cortes, reducaoDb: 0, avisos: 0 };
      anti.current = pecas;
      let vigiaLigada = false;
      const vigia = window.setInterval(() => {
        if (!voz.current.ligada) { vigiaLigada = false; return; }
        if (!vigiaLigada) { vigiaLigada = true; pecas.detector.reiniciar(); }
        // Microfonia: pico estreito parado numa frequência que persiste ou cresce vira um corte; sem recurso, baixa a voz.
        analisadorRetorno.getFloatFrequencyData(espectro);
        const agora = performance.now();
        const det = pecas.detector.analisar(espectro, agora);
        if (!det) return;
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
            aoRetornoRef.current?.(AVISO_RETORNO);
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
      try {
        if (!ctx.audioWorklet) throw new Error('sem AudioWorklet');
        const url = URL.createObjectURL(new Blob([CODIGO_CAPTURA], { type: 'text/javascript' }));
        try { await ctx.audioWorklet.addModule(url); } finally { URL.revokeObjectURL(url); }
        if (token !== audio.current.token) { stream.getTracks().forEach((t) => t.stop()); void ctx.close().catch(() => undefined); return; }
        node = new AudioWorkletNode(ctx, 'karaoke-captura', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], processorOptions: { janela: janelaN, passo: Math.round(ctx.sampleRate * 0.033) } });
        node.port.onmessage = (e: MessageEvent<{ t: number; buf: Float32Array }>) => processar(e.data.buf, Math.max(0, (ctx.currentTime - e.data.t) * 1000));
        const mudo = ctx.createGain();
        mudo.gain.value = 0;
        fonte.connect(node);
        node.connect(mudo);
        mudo.connect(ctx.destination);
      } catch {
        node = undefined;
        timer = window.setInterval(() => { analisador.getFloatTimeDomainData(buf); processar(buf, 0); }, 33);
      }

      audio.current = { ctx, stream, timer, node, vozGain, timerAnti: vigia, timerInfo, ctxMon, streamMon, fonteMon, token };
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
    return { atrasoMs: m === null || inconsistente ? null : Math.round(m * 10) / 10, medidas: medidas.map((x) => Math.round(x * 10) / 10), falhas, inconsistente, razoes };
  }, [aplicarVolume]);

  /** Cortes ativos (frequência e profundidade) e redução de ganho, ou null com o microfone fechado (depuração). */
  const lerAntiMic = useCallback(() => { const p = anti.current; return p ? { ...p.gerente.estado(), reducaoDb: p.reducaoDb } : null; }, []);

  /** Zera os cortes e a redução de ganho da anti-microfonia. */
  const resetarAntiMicrofonia = useCallback(() => {
    const p = anti.current;
    const ctx = audio.current.ctx;
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

  return { infoMonitor, medirAtraso, lerAntiMic, ecoAtivo, antiMic, resetarAntiMicrofonia, infoAudio, definirOuvinte, definirModoEstudio, obterStream, status, erro, dispositivos, ativoId, vivo, historico, ligar, desligar, retomar, listar, iniciarGravacao, pausarGravacao, pararGravacao };
}
