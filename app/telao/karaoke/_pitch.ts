'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PitchDetector } from 'pitchy';
import { cantando, hzParaMidi, limiarDeVoz, medirRuido, type Quadro } from './pontuacao';

// Microfone do telão: abre o dispositivo escolhido, mede a altura da voz com pitchy e (opcional) devolve a voz na TV com reverb.
// A parte de contas (nota, estrelas) fica em pontuacao.ts, que é pura e testada.
export * from './pontuacao';

export type Dispositivo = { deviceId: string; label: string };
export type Vivo = { midi: number | null; hz: number; rms: number; cantando: boolean; limiar: number };
export type PontoAltura = { t: number; midi: number | null };
export type StatusMic = 'parado' | 'abrindo' | 'ativo' | 'erro';

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

const SEM_VOZ: Vivo = { midi: null, hz: 0, rms: 0, cantando: false, limiar: limiarDeVoz(0) };

function mensagemDeErro(err: unknown): string {
  const nome = (err as { name?: string })?.name;
  if (nome === 'NotAllowedError' || nome === 'SecurityError') return 'O navegador bloqueou o microfone. Libere nas permissões do site e tente de novo.';
  if (nome === 'NotFoundError') return 'Nenhum microfone encontrado. Confira se o USB está conectado.';
  if (nome === 'NotReadableError') return 'O microfone está em uso por outro programa.';
  return 'Não consegui abrir o microfone.';
}

export function useAfinacao(deviceId: string | null, opcoes: { vozNaTv?: boolean; volumeVoz?: number } = {}) {
  const { vozNaTv = false, volumeVoz = 0.8 } = opcoes;
  const [status, setStatus] = useState<StatusMic>('parado');
  const [erro, setErro] = useState('');
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [ativoId, setAtivoId] = useState<string | null>(null);
  /** Leitura atual (altura, volume). Muda a 30 vezes por segundo: por isso é ref e não estado. */
  const vivo = useRef<Vivo>(SEM_VOZ);
  /** Últimos segundos de altura, para o medidor desenhar a linha rolando. */
  const historico = useRef<PontoAltura[]>([]);
  const audio = useRef<{ ctx?: AudioContext; stream?: MediaStream; timer?: number; vozGain?: GainNode; token: number }>({ token: 0 });
  const gravacao = useRef<{ ativa: boolean; pausada: boolean; t0: number; quadros: Quadro[]; limiar: number; posicao?: () => number }>({ ativa: false, pausada: false, t0: 0, quadros: [], limiar: 0 });
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
    a.stream?.getTracks().forEach((t) => t.stop());
    void a.ctx?.close().catch(() => undefined);
    a.stream = undefined; a.ctx = undefined; a.vozGain = undefined;
    vivo.current = SEM_VOZ;
    historico.current = [];
  }, []);

  const abrir = useCallback(async (id: string | null) => {
    if (!navigator.mediaDevices?.getUserMedia) { setErro('Este navegador não libera o microfone nesta página (precisa de HTTPS).'); setStatus('erro'); return; }
    parar();
    const token = audio.current.token;
    setStatus('abrindo'); setErro('');
    const base = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 };
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
      const fonte = ctx.createMediaStreamSource(stream);
      const analisador = ctx.createAnalyser();
      analisador.fftSize = 2048;
      fonte.connect(analisador);

      // Voz na TV: microfone -> ganho -> destino (seca) e -> reverb -> destino. Ganho 0 = desligado.
      const vozGain = ctx.createGain();
      vozGain.gain.value = voz.current.ligada ? voz.current.volume : 0;
      const reverb = ctx.createConvolver();
      reverb.buffer = criarImpulso(ctx);
      const reverbGain = ctx.createGain();
      reverbGain.gain.value = 0.45;
      fonte.connect(vozGain);
      vozGain.connect(ctx.destination);
      vozGain.connect(reverb);
      reverb.connect(reverbGain);
      reverbGain.connect(ctx.destination);

      const buf = new Float32Array(analisador.fftSize);
      const detector = PitchDetector.forFloat32Array(analisador.fftSize);
      let recentes: number[] = [];
      let semVoz = 0;
      const timer = window.setInterval(() => {
        analisador.getFloatTimeDomainData(buf);
        let soma = 0;
        for (let i = 0; i < buf.length; i++) soma += buf[i] * buf[i];
        const rms = Math.sqrt(soma / buf.length);
        let hz = 0;
        let clareza = 0;
        if (rms > 0.004) [hz, clareza] = detector.findPitch(buf, ctx.sampleRate);
        const agora = performance.now();
        const g = gravacao.current;
        if (g.ativa && !g.pausada) {
          g.quadros.push(g.posicao ? { t: agora - g.t0, hz, clareza, rms, m: g.posicao() } : { t: agora - g.t0, hz, clareza, rms });
          if (!g.limiar && agora - g.t0 >= 2000) g.limiar = limiarDeVoz(medirRuido(g.quadros));
        }
        const limiar = g.limiar || limiarDeVoz(0);
        const q: Quadro = { t: agora, hz, clareza, rms };
        const valido = cantando(q, limiar);
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
        while (h.length && agora - h[0].t > 12000) h.shift();
      }, 33);

      audio.current = { ctx, stream, timer, vozGain, token };
      setAtivoId(stream.getAudioTracks()[0]?.getSettings().deviceId ?? id);
      setStatus('ativo');
      void listar();
    } catch (e) {
      if (token === audio.current.token) { setErro(mensagemDeErro(e)); setStatus('erro'); }
    }
  }, [listar, parar]);

  // Volume e liga/desliga da voz na TV.
  useEffect(() => {
    voz.current = { ligada: vozNaTv, volume: volumeVoz };
    const g = audio.current.vozGain;
    const ctx = audio.current.ctx;
    if (g && ctx) g.gain.setTargetAtTime(vozNaTv ? volumeVoz : 0, ctx.currentTime, 0.03);
  }, [vozNaTv, volumeVoz]);

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

  const retomar = useCallback(() => { void audio.current.ctx?.resume().catch(() => undefined); }, []);
  const ligar = useCallback(() => abrir(idPedido.current), [abrir]);
  const desligar = useCallback(() => { parar(); setStatus('parado'); }, [parar]);

  /** Começa a guardar os quadros (chamar quando a música começa a tocar). posicao: ms atuais do vídeo, para casar a voz com a letra. */
  const iniciarGravacao = useCallback((posicao?: () => number) => {
    gravacao.current = { ativa: true, pausada: false, t0: performance.now(), quadros: [], limiar: 0, posicao };
  }, []);
  const pausarGravacao = useCallback((pausada: boolean) => { gravacao.current.pausada = pausada; }, []);
  const pararGravacao = useCallback((): Quadro[] => {
    const q = gravacao.current.quadros;
    gravacao.current = { ativa: false, pausada: false, t0: 0, quadros: [], limiar: 0 };
    return q;
  }, []);

  return { status, erro, dispositivos, ativoId, vivo, historico, ligar, desligar, retomar, listar, iniciarGravacao, pausarGravacao, pararGravacao };
}
