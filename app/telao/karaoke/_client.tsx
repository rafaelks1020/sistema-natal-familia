'use client';
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { FastForward, Mic, MicOff, Pause, Play, Rewind, SkipForward, Star, Volume2, VolumeX, Repeat } from 'lucide-react';
import { api } from '@/app/ui/client';
import { Confete } from '../_confete';
import { MedidorAfinacao } from './_medidor';
import { FundoLetra, LetraPalco } from './_letra';
import { FundoEstudio, PalcoEstudio } from './_estudio';
import { MedidorPlateia } from './_plateia';
import { janelasDaLetra, prepararLetra, type LinhaCantada } from './letra';
import { CLAREZA_MINIMA, HZ_MAX, HZ_MIN, LATENCIA_MAX_MS, LATENCIA_PADRAO_MS, PlateiaEnergia, PontuacaoAoVivo, forcaEstudio, forcaLetra, hzParaMidi, limiarDeVozEstudio, pontuar, pontuarEstudio, prepararNotas, useAfinacao, type EventoAoVivo, type Quadro, type Resultado, type ResultadoEstudio } from './_pitch';
import { quemCanta, type DadosEstudio, type EstadoKaraoke, type ItemFila } from './tipos';
import styles from './karaoke.module.css';

const URL_QR = 'https://natalemfamilia.com.br/karaoke';
const CONTAGEM_S = 5;
const NOTA_MS = 15000;
const LS_DISPOSITIVO = 'karaoke.mic.dispositivo';
const LS_LIGADO = 'karaoke.mic.ligado';
const LS_VOLUME = 'karaoke.voz.volume';
const LS_LATENCIA = 'karaoke.estudio.latencia';
const LS_OFFSET_ESTUDIO = 'karaoke.estudio.offset';
const PASSO_OFFSET_MS = 250;
const OFFSET_MAX_MS = 30000;
const ATRASO_GRAVAR_OFFSET_MS = 400;
/** Erros do IFrame em que o vídeo não toca embutido: tenta outra versão em vez de pular a música. */
const ERROS_TROCAVEIS = [100, 101, 150, 153];
const MAX_TROCAS = 4;
const CONTAGEM_TROCA_S = 3;

const formatarOffset = (ms: number) => `${ms > 0 ? '+' : ''}${(ms / 1000).toFixed(2).replace('.', ',')} s`;

// ---------- YouTube IFrame API (só os pedaços usados) ----------
interface YTPlayer {
  loadVideoById(id: string): void; playVideo(): void; pauseVideo(): void; stopVideo(): void;
  getPlayerState(): number; getDuration(): number; getCurrentTime(): number; destroy(): void;
}
interface YTNamespace {
  Player: new (el: HTMLElement, opts: {
    width: string; height: string; playerVars: Record<string, string | number>;
    events: { onReady: () => void; onStateChange: (e: { data: number }) => void; onError: (e: { data: number }) => void };
  }) => YTPlayer;
}
declare global { interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void } }

let carregandoYT: Promise<YTNamespace> | null = null;
function carregarYT(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  carregandoYT ??= new Promise<YTNamespace>((resolve, reject) => {
    const anterior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { anterior?.(); if (window.YT) resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => { carregandoYT = null; reject(new Error('player')); };
    document.head.appendChild(s);
  });
  return carregandoYT;
}
const ENDED = 0, PLAYING = 1, PAUSED = 2, BUFFERING = 3;

function lerLS(chave: string): string | null {
  try { return window.localStorage.getItem(chave); } catch { return null; }
}
function gravarLS(chave: string, valor: string | null) {
  try { if (valor === null) window.localStorage.removeItem(chave); else window.localStorage.setItem(chave, valor); } catch { /* sem armazenamento */ }
}

/** Música no modo estúdio com os dados (instrumental, palavras e notas) já carregados. */
const usaEstudio = (i: ItemFila | null | undefined): i is ItemFila & { estudio: DadosEstudio } => Boolean(i && i.modo === 'estudio' && i.estudio);

function latenciaSalva(): number {
  const bruto = lerLS(LS_LATENCIA);
  const n = Number(bruto);
  return bruto !== null && Number.isFinite(n) && n >= 0 && n <= LATENCIA_MAX_MS ? Math.round(n) : LATENCIA_PADRAO_MS;
}
function offsetEstudioSalvo(): number {
  const n = Number(lerLS(LS_OFFSET_ESTUDIO));
  return Number.isFinite(n) ? Math.max(-OFFSET_MAX_MS, Math.min(OFFSET_MAX_MS, Math.round(n))) : 0;
}

type Fase = 'ocioso' | 'contagem' | 'cantando' | 'nota' | 'pulando' | 'trocando';

const TENTATIVAS_PATCH = 3;
const INTERVALO_PATCH_MS = 2000;
const AVISO_MICROFONIA = 'Use fone ou mantenha o microfone longe das caixas para evitar microfonia';
const esperar = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, ms); });

const FRASES: Record<number, string> = {
  5: 'Arrasou! Parece show de verdade!',
  4: 'Que voz! Mandou muito bem!',
  3: 'Mandou bem! Já dá para subir no palco!',
  2: 'Boa! O que vale é se divertir!',
  1: 'Valeu pela coragem! Na próxima vai ser melhor!',
};

function useNumeroAnimado(alvo: number, ms = 1800) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const passo = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(Math.round(alvo * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo, ms]);
  return v;
}

function NotaCena({ item, r, posicao }: { item: ItemFila; r: Resultado | null; posicao: number | null }) {
  const numero = useNumeroAnimado(r?.nota ?? 0);
  const est = r && 'resumo' in r ? (r as ResultadoEstudio) : null;
  const pontos = useNumeroAnimado(Math.round(est?.total ?? 0));
  return <div className={styles.cartaz}>
    <Confete modo={r && r.estrelas >= 4 ? 'explosao' : 'rajada'} />
    <p className={styles.kicker}>{r ? 'Nota da apresentação' : 'Apresentação encerrada'}</p>
    <p className={styles.subtitulo}>{quemCanta(item)} · {item.titulo}</p>
    {!r ? <p className={styles.frase}>Sem nota desta vez: ligue o microfone (botão Microfone) e cante pelo menos uns 20 segundos.</p> : null}
    {r ? <>
      <p className={styles.notaNumero} aria-label={`Nota ${r.nota}`}>{numero}</p>
      <div className={styles.estrelas} aria-label={`${r.estrelas} de 5 estrelas`}>
        {[0, 1, 2, 3, 4].map((i) => i < r.estrelas
          ? <Star key={i} className={`${styles.estrela} ${styles.estrelaCheia}`} style={{ ['--atraso' as string]: `${1.6 + i * 0.28}s` }} strokeWidth={1.5} />
          : <Star key={i} className={`${styles.estrela} ${styles.estrelaVazia}`} strokeWidth={1.5} />)}
      </div>
      <p className={styles.frase}>{FRASES[r.estrelas]}</p>
      <ul className={styles.notaDetalhes}>
        {est ? <li><b>{pontos.toLocaleString('pt-BR')}</b> pontos</li> : null}
        {est ? <li>Maior sequência: <b>{est.resumo.maiorSequencia}</b> {est.resumo.maiorSequencia === 1 ? 'nota' : 'notas'} (combo <b>x{est.resumo.maiorCombo}</b>)</li> : null}
        {est ? <li>Notas perfeitas: <b>{Math.round(est.resumo.perfeitasPct * 100)}%</b></li> : null}
        {posicao ? <li>Ranking da noite: <b>{posicao}º lugar</b></li> : null}
      </ul>
    </> : <p className={styles.titulo}>Valeu por cantar!</p>}
  </div>;
}

export default function KaraokeTelao({ admin }: { admin: boolean }) {
  const [estado, setEstado] = useState<EstadoKaraoke | null>(null);
  const [fase, setFase] = useState<Fase>('ocioso');
  const [contagem, setContagem] = useState(CONTAGEM_S);
  const [resultado, setResultado] = useState<{ item: ItemFila; r: Resultado | null } | null>(null);
  const [aviso, setAviso] = useState('');
  const [config, setConfig] = useState(false);
  const [tocando, setTocando] = useState(false);
  const [auto, setAuto] = useState(true);
  const [vozNaTv, setVozNaTv] = useState(false);
  const [volumeVoz, setVolumeVoz] = useState(() => { const n = Number(lerLS(LS_VOLUME)); return Number.isFinite(n) && n > 0 && n <= 1 ? Math.min(n, 0.5) : 0.4; });
  const [deviceId, setDeviceId] = useState<string | null>(() => lerLS(LS_DISPOSITIVO));
  const [qr, setQr] = useState('');
  const [emCurso, setEmCurso] = useState<ItemFila | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [latenciaMs, setLatenciaMs] = useState(latenciaSalva);

  const pitch = useAfinacao(deviceId, { vozNaTv, volumeVoz });
  const { iniciarGravacao, pausarGravacao, pararGravacao, retomar, ligar, definirOuvinte, definirModoEstudio } = pitch;

  const caixaRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const latenciaRef = useRef(LATENCIA_PADRAO_MS);
  /** Pontuação ao vivo da música em modo estúdio, fila de acontecimentos para a tela, energia da plateia e linhas da letra (modo letra). */
  const motorRef = useRef<PontuacaoAoVivo | null>(null);
  const eventosRef = useRef<EventoAoVivo[]>([]);
  const plateiaRef = useRef<PlateiaEnergia>(new PlateiaEnergia());
  const linhasLetraRef = useRef<LinhaCantada[]>([]);
  const ultimoQuadroRef = useRef(-1);
  const prontoRef = useRef(false);
  const faseRef = useRef<Fase>('ocioso');
  const estadoRef = useRef<EstadoKaraoke | null>(null);
  const emCursoRef = useRef<ItemFila | null>(null);
  const gravandoRef = useRef(false);
  /** Ids da fila que não podem mais abrir contagem (vídeo com erro ou apresentação já encerrada no cliente). */
  const ignoradosRef = useRef<Set<number>>(new Set());
  const ocupadoRef = useRef(false);
  const seqRef = useRef(0);
  const autoRef = useRef(true);
  const micRef = useRef(false);
  const timerContagem = useRef<number | undefined>(undefined);
  const timerNota = useRef<number | undefined>(undefined);
  const timerEspera = useRef<number | undefined>(undefined);
  const timerAviso = useRef<number | undefined>(undefined);
  const tratadores = useRef<{ finalizar: () => void; erroVideo: (codigo?: number) => void }>({ finalizar: () => undefined, erroVideo: () => undefined });
  const nivelRef = useRef<HTMLDivElement>(null);
  const configRef = useRef<HTMLDivElement>(null);
  const botaoMicRef = useRef<HTMLButtonElement>(null);
  /** Ajuste da letra (ms) da música em andamento; vale na hora e é gravado depois de uma pequena espera. */
  const offsetRef = useRef(0);
  const timerOffset = useRef<number | undefined>(undefined);
  const relogioRef = useRef({ v: 0, w: 0, saida: 0 });
  const trocasRef = useRef<Map<number, number>>(new Map());

  useEffect(() => { autoRef.current = auto; micRef.current = pitch.status === 'ativo'; latenciaRef.current = latenciaMs; });

  const definirEmCurso = useCallback((i: ItemFila | null) => { emCursoRef.current = i; setEmCurso(i); }, []);
  const mudarFase = useCallback((f: Fase) => { faseRef.current = f; setFase(f); if (f !== 'ocioso') setConfig(false); }, []);
  const avisar = useCallback((texto: string) => {
    setAviso(texto);
    window.clearTimeout(timerAviso.current);
    timerAviso.current = window.setTimeout(() => setAviso(''), 6000);
  }, []);

  /** Posição do vídeo (ou do instrumental, no modo estúdio) em ms, interpolada entre as leituras (que andam em degraus) para o preenchimento ficar suave. */
  const msVideo = useCallback((): number => {
    const r = relogioRef.current;
    const atualEm = emCursoRef.current;
    let v = 0;
    let rodando = false;
    if (usaEstudio(atualEm)) {
      const a = audioRef.current;
      if (!a) return r.saida;
      v = a.currentTime * 1000; rodando = !a.paused && !a.ended;
    } else {
      const p = playerRef.current;
      if (!p || !prontoRef.current) return r.saida;
      try { v = p.getCurrentTime() * 1000; rodando = p.getPlayerState() === PLAYING; } catch { return r.saida; }
    }
    const agora = performance.now();
    if (v !== r.v) { r.v = v; r.w = agora; }
    let est = rodando ? r.v + Math.min(agora - r.w, 300) : r.v;
    if (est < r.saida && r.saida - est < 200) est = r.saida;
    r.saida = est;
    return est;
  }, []);
  /** Instante da letra: posição do vídeo menos o ajuste (ajuste positivo atrasa a letra). */
  const lerMsLetra = useCallback(() => msVideo() - offsetRef.current, [msVideo]);

  const limparTimers = useCallback(() => {
    window.clearInterval(timerContagem.current); window.clearTimeout(timerNota.current); window.clearInterval(timerEspera.current);
  }, []);

  const abortar = useCallback(() => {
    limparTimers();
    try { playerRef.current?.stopVideo(); } catch { /* player ainda não pronto */ }
    audioRef.current?.pause();
    pararGravacao(); gravandoRef.current = false;
    definirEmCurso(null);
    setTocando(false);
    mudarFase('ocioso');
  }, [limparTimers, definirEmCurso, mudarFase, pararGravacao]);

  const tocar = useCallback((item: ItemFila) => {
    if (usaEstudio(item)) {
      const a = audioRef.current;
      if (!a) { tratadores.current.erroVideo(); return; }
      mudarFase('cantando');
      a.currentTime = 0;
      a.play().catch(() => avisar('O navegador bloqueou o som. Toque na tela e aperte Continuar.'));
      return;
    }
    const comecar = () => { mudarFase('cantando'); playerRef.current?.loadVideoById(item.video_id); };
    if (playerRef.current && prontoRef.current) { comecar(); return; }
    window.clearInterval(timerEspera.current);
    timerEspera.current = window.setInterval(() => {
      if (playerRef.current && prontoRef.current) { window.clearInterval(timerEspera.current); comecar(); }
    }, 300);
  }, [mudarFase, avisar]);

  const entrarContagem = useCallback((item: ItemFila, segundos = CONTAGEM_S) => {
    limparTimers();
    definirEmCurso(item);
    gravandoRef.current = false;
    if (usaEstudio(item)) {
      // Estúdio: o ajuste é do notebook (atraso do áudio), não da música: fica no navegador. O instrumental carrega durante a contagem.
      offsetRef.current = offsetEstudioSalvo();
      const a = audioRef.current;
      if (a) { a.pause(); if (a.getAttribute('src') !== item.estudio.audio_url) { a.src = item.estudio.audio_url; a.load(); } else a.currentTime = 0; }
    } else offsetRef.current = item.offset_ms || 0;
    setOffsetMs(offsetRef.current);
    // Placar e plateia da música que vai começar.
    eventosRef.current = []; ultimoQuadroRef.current = -1; plateiaRef.current.reiniciar();
    definirModoEstudio(usaEstudio(item));
    motorRef.current = usaEstudio(item) ? new PontuacaoAoVivo(prepararNotas(item.estudio.notas), { latenciaMs: latenciaRef.current, offsetMs: offsetRef.current }) : null;
    linhasLetraRef.current = item.modo === 'letra' ? prepararLetra(item.letra) : [];
    relogioRef.current = { v: 0, w: 0, saida: 0 };
    setResultado(null); setContagem(segundos);
    mudarFase('contagem');
    let n = segundos;
    timerContagem.current = window.setInterval(() => {
      n -= 1;
      if (n <= 0) { window.clearInterval(timerContagem.current); tocar(item); } else setContagem(n);
    }, 1000);
  }, [limparTimers, definirEmCurso, mudarFase, tocar, definirModoEstudio]);

  const aplicar = useCallback((novo: EstadoKaraoke) => {
    estadoRef.current = novo;
    setEstado(novo);
    if (!admin) return;
    const f = faseRef.current;
    if ((f === 'contagem' || f === 'cantando') && novo.atual?.id !== emCursoRef.current?.id) abortar();
    else if (f === 'ocioso' && novo.atual && !ignoradosRef.current.has(novo.atual.id)) entrarContagem(novo.atual);
  }, [admin, abortar, entrarContagem]);

  const recarregar = useCallback(async () => {
    if (ocupadoRef.current) return;
    const s = ++seqRef.current;
    try {
      const novo = await api<EstadoKaraoke>('/api/karaoke/fila?letra=1');
      if (s === seqRef.current && !ocupadoRef.current) aplicar(novo);
    } catch { /* tenta de novo no próximo ciclo */ }
  }, [aplicar]);

  /** Ação de admin na fila (PATCH). Pausa a sincronização enquanto roda, para a resposta antiga não desfazer o passo. */
  const acao = useCallback(async (corpo: Record<string, unknown>): Promise<EstadoKaraoke | null> => {
    ocupadoRef.current = true; seqRef.current++;
    try {
      const novo = await api<EstadoKaraoke>('/api/karaoke/fila', { method: 'PATCH', json: corpo });
      ocupadoRef.current = false; seqRef.current++;
      aplicar(novo);
      return novo;
    } catch (e) {
      ocupadoRef.current = false;
      const msg = (e as Error).message;
      if (!/já foi encerrada|Não há música/.test(msg)) avisar(msg);
      return null;
    }
  }, [aplicar, avisar]);

  /** Repete o PATCH até 3 vezes (com intervalo) quando falha; devolve null se nenhuma deu certo. */
  const acaoComRetentativa = useCallback(async (corpo: Record<string, unknown>): Promise<EstadoKaraoke | null> => {
    for (let i = 0; i < TENTATIVAS_PATCH; i++) {
      const novo = await acao(corpo);
      if (novo) return novo;
      if (i < TENTATIVAS_PATCH - 1) await esperar(INTERVALO_PATCH_MS);
    }
    return null;
  }, [acao]);

  const iniciar = useCallback(async (id?: number) => {
    await acao({ acao: 'comecar', ...(id ? { id } : {}) });
  }, [acao]);

  const sairDaNota = useCallback(() => {
    window.clearTimeout(timerNota.current);
    definirEmCurso(null);
    setResultado(null);
    mudarFase('ocioso');
    if (autoRef.current && (estadoRef.current?.fila.length ?? 0) > 0) void iniciar();
  }, [iniciar, definirEmCurso, mudarFase]);

  const finalizar = useCallback((antes = false) => {
    const item = emCursoRef.current;
    if (!item || faseRef.current !== 'cantando') return;
    // Encerrar antes do fim: a nota considera só o trecho que tocou.
    const estudio = usaEstudio(item);
    const a = audioRef.current;
    const tocouMs = antes ? ((estudio ? a?.currentTime : playerRef.current?.getCurrentTime()) || 0) * 1000 : 0;
    if (antes) { if (estudio) a?.pause(); else playerRef.current?.pauseVideo(); }
    ignoradosRef.current.add(item.id);
    const quadros = pararGravacao();
    gravandoRef.current = false;
    setTocando(false);
    const duracao = antes && tocouMs > 0 ? tocouMs : ((estudio ? a?.duration : playerRef.current?.getDuration()) || item.duracao_s || 0) * 1000;
    let r: Resultado | null = null;
    if (estudio) {
      // Estúdio: nota pelas notas da melodia; encerrando antes do fim, só valem as notas que já passaram.
      const corte = antes ? tocouMs - offsetRef.current - latenciaRef.current : Infinity;
      const notas = prepararNotas(item.estudio.notas).filter((n) => n.inicio_ms + n.dur_ms <= corte);
      if (micRef.current && quadros.length > 60 && notas.length >= 3) {
        // Fim natural: vale o placar ao vivo (mesma conta, termina exatamente nele). Encerrando antes, recalcula só com as notas que passaram.
        const motor = motorRef.current;
        r = !antes && motor ? motor.resultado() : pontuarEstudio(quadros, notas, latenciaRef.current, offsetRef.current);
      }
    } else {
      // Com a letra na tela, a nota considera só as linhas cantadas (a posição do vídeo vem em cada quadro).
      const janelas = item.modo === 'letra' ? janelasDaLetra(prepararLetra(item.letra), offsetRef.current) : undefined;
      r = micRef.current && quadros.length > 60 && duracao > 0 ? pontuar(quadros, duracao, undefined, janelas) : null;
    }
    setResultado({ item, r });
    mudarFase('nota');
    window.clearTimeout(timerNota.current);
    timerNota.current = window.setTimeout(sairDaNota, NOTA_MS);
    void acaoComRetentativa({ acao: 'terminar', id: item.id, ...(r ? { nota: r.nota, estrelas: r.estrelas, detalhes: r.detalhes } : {}) });
  }, [acaoComRetentativa, mudarFase, pararGravacao, sairDaNota]);

  const erroVideo = useCallback((codigo?: number) => {
    const item = emCursoRef.current;
    if (!item || faseRef.current === 'trocando') return;
    const trocas = trocasRef.current.get(item.id) ?? 0;
    if (codigo !== undefined && ERROS_TROCAVEIS.includes(codigo) && trocas < MAX_TROCAS) {
      // O dono do vídeo não deixa tocar embutido: pede outra versão ao servidor e recarrega no mesmo player.
      console.error('karaoke: erro do YouTube', codigo, item.video_id, '- trocando de vídeo');
      trocasRef.current.set(item.id, trocas + 1);
      limparTimers();
      try { playerRef.current?.stopVideo(); } catch { /* player ainda não pronto */ }
      pararGravacao(); gravandoRef.current = false;
      setTocando(false);
      mudarFase('trocando');
      void acao({ acao: 'trocar_video', id: item.id, video_id_falho: item.video_id, codigo }).then((novo) => {
        if (faseRef.current !== 'trocando') return;
        const novoItem = novo?.atual;
        if (novoItem && novoItem.id === item.id && novoItem.video_id !== item.video_id) entrarContagem(novoItem, CONTAGEM_TROCA_S);
        else { mudarFase('cantando'); tratadores.current.erroVideo(-1); } // sem outra versão: pula como nos outros erros
      });
      return;
    }
    console.error('karaoke: erro do YouTube', codigo, item.video_id);
    // Id falho nunca reabre contagem; a fase 'pulando' segura tudo até o PATCH de pular terminar.
    ignoradosRef.current.add(item.id);
    avisar(`Esse vídeo não pode ser tocado aqui (código ${codigo ?? '?'}). Passando para o próximo.`);
    abortar();
    mudarFase('pulando');
    window.setTimeout(() => {
      void acaoComRetentativa({ acao: 'pular', id: item.id }).then(() => {
        if (faseRef.current === 'pulando') mudarFase('ocioso');
        if (autoRef.current && (estadoRef.current?.fila.filter((f) => f.id !== item.id).length ?? 0) > 0) void iniciar();
      });
    }, 2500);
  }, [abortar, acao, acaoComRetentativa, avisar, entrarContagem, iniciar, limparTimers, mudarFase, pararGravacao]);

  useEffect(() => { tratadores.current = { finalizar, erroVideo }; }, [finalizar, erroVideo]);

  const ajustarLetra = useCallback((delta: number) => {
    const atualEm = emCursoRef.current;
    const id = atualEm?.id;
    if (!id) return;
    offsetRef.current = Math.max(-OFFSET_MAX_MS, Math.min(OFFSET_MAX_MS, offsetRef.current + delta));
    setOffsetMs(offsetRef.current);
    if (usaEstudio(atualEm)) { gravarLS(LS_OFFSET_ESTUDIO, String(offsetRef.current)); return; }
    window.clearTimeout(timerOffset.current);
    timerOffset.current = window.setTimeout(() => { void acao({ acao: 'offset', id, offset_ms: offsetRef.current }); }, ATRASO_GRAVAR_OFFSET_MS);
  }, [acao]);

  const pular = useCallback(async () => {
    const alvo = estadoRef.current?.atual ?? estadoRef.current?.fila[0];
    if (!alvo) return;
    if (faseRef.current === 'contagem' || faseRef.current === 'cantando') abortar();
    await acao({ acao: 'pular', id: alvo.id });
  }, [abortar, acao]);

  const alternarPausa = useCallback(() => {
    if (faseRef.current !== 'cantando') return;
    if (usaEstudio(emCursoRef.current)) {
      const a = audioRef.current;
      if (a?.paused) a.play().catch(() => undefined); else a?.pause();
      return;
    }
    const p = playerRef.current;
    if (!p) return;
    if (p.getPlayerState() === PLAYING) p.pauseVideo(); else p.playVideo();
  }, []);

  // Player do YouTube: criado uma vez, reaproveitado em todas as músicas.
  useEffect(() => {
    const caixa = caixaRef.current;
    if (!admin || !caixa) return;
    let morto = false;
    const alvo = document.createElement('div');
    caixa.appendChild(alvo);
    carregarYT().then((YT) => {
      if (morto) return;
      playerRef.current = new YT.Player(alvo, {
        width: '100%', height: '100%',
        playerVars: { autoplay: 1, controls: 0, rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3, fs: 0, disablekb: 1, origin: window.location.origin },
        events: {
          onReady: () => { prontoRef.current = true; },
          onStateChange: (e) => {
            if (faseRef.current !== 'cantando') return;
            if (e.data === PLAYING) {
              setTocando(true);
              ultimoQuadroRef.current = -1;
              if (!gravandoRef.current) { iniciarGravacao(msVideo); gravandoRef.current = true; } else pausarGravacao(false);
            } else if (e.data === PAUSED || e.data === BUFFERING) { setTocando(false); pausarGravacao(true); }
            else if (e.data === ENDED) tratadores.current.finalizar();
          },
          onError: (e) => tratadores.current.erroVideo(e.data),
        },
      });
    }).catch(() => setAviso('Não consegui carregar o player do YouTube. Confira a internet.'));
    return () => {
      morto = true;
      window.clearInterval(timerContagem.current); window.clearTimeout(timerNota.current); window.clearInterval(timerEspera.current);
      try { playerRef.current?.destroy(); } catch { /* já destruído */ }
      playerRef.current = null; prontoRef.current = false;
      alvo.remove();
    };
  }, [admin, iniciarGravacao, pausarGravacao, msVideo]);

  // Cada quadro do microfone alimenta a pontuação ao vivo (estúdio) e a plateia (estúdio e letra).
  useEffect(() => {
    definirOuvinte((q: Quadro, limiar: number, ruido: number) => {
      const atualEm = emCursoRef.current;
      if (!atualEm || faseRef.current !== 'cantando') return;
      const dt = ultimoQuadroRef.current >= 0 ? Math.min(100, Math.max(0, q.t - ultimoQuadroRef.current)) : 33;
      ultimoQuadroRef.current = q.t;
      const emFaixa = q.hz >= HZ_MIN && q.hz <= HZ_MAX;
      if (usaEstudio(atualEm)) {
        const motor = motorRef.current;
        if (!motor || typeof q.m !== 'number') return;
        motor.definirLimiar(limiarDeVozEstudio(ruido));
        motor.definirAjuste(latenciaRef.current, offsetRef.current);
        const ev = motor.adicionarQuadro(q.m, emFaixa ? hzParaMidi(q.hz) : null, q.clareza, q.rms, dt);
        if (ev.length) {
          const fila = eventosRef.current;
          fila.push(...ev);
          if (fila.length > 300) fila.splice(0, fila.length - 300);
        }
        plateiaRef.current.atualizar(dt, forcaEstudio(motor.ultimoQuadro));
      } else if (atualEm.modo === 'letra' && typeof q.m === 'number') {
        const t = q.m - offsetRef.current;
        const dentro = linhasLetraRef.current.some((l) => t >= l.ini && t < l.janelaFim);
        plateiaRef.current.atualizar(dt, forcaLetra(dentro, q.clareza >= CLAREZA_MINIMA && q.rms > limiar && emFaixa));
      }
    });
    return () => definirOuvinte(null);
  }, [definirOuvinte]);

  // Placar parcial para o celular ("Agora: Fulano, 4.230 pontos"): a cada 3 s, só quando mudou.
  const emCursoId = emCurso?.id;
  const estudioNoPalco = fase === 'cantando' && usaEstudio(emCurso);
  useEffect(() => {
    if (!admin || !estudioNoPalco || !emCursoId) return;
    let ultimo = -1;
    const t = window.setInterval(() => {
      const e = motorRef.current?.estado();
      if (!e || e.pontos === ultimo) return;
      ultimo = e.pontos;
      void api('/api/karaoke/fila', { method: 'PATCH', json: { acao: 'parcial', id: emCursoId, pontos: e.pontos } }).catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(t);
  }, [admin, estudioNoPalco, emCursoId]);

  // Sincroniza com o servidor.
  useEffect(() => {
    const inicio = window.setTimeout(() => void recarregar(), 0);
    const t = window.setInterval(() => void recarregar(), 4000);
    return () => { window.clearTimeout(inicio); window.clearInterval(t); };
  }, [recarregar]);

  useEffect(() => {
    let vivo = true;
    QRCode.toDataURL(URL_QR, { margin: 1, width: 480, errorCorrectionLevel: 'M', color: { dark: '#171b18', light: '#f3ebdc' } })
      .then((url) => { if (vivo) setQr(url); }).catch(() => undefined);
    return () => { vivo = false; };
  }, []);

  // Microfone: religa sozinho se estava ligado e destrava o áudio no primeiro toque.
  useEffect(() => {
    if (!admin) return;
    if (lerLS(LS_LIGADO) === '1') void ligar();
    const destravar = () => retomar();
    window.addEventListener('pointerdown', destravar);
    window.addEventListener('keydown', destravar);
    return () => { window.removeEventListener('pointerdown', destravar); window.removeEventListener('keydown', destravar); };
  }, [admin, ligar, retomar]);

  // O painel do microfone fecha ao clicar fora dele (para não cobrir a letra).
  useEffect(() => {
    if (!config) return;
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node | null;
      if (alvo && (configRef.current?.contains(alvo) || botaoMicRef.current?.contains(alvo))) return;
      setConfig(false);
    };
    document.addEventListener('pointerdown', fora);
    return () => document.removeEventListener('pointerdown', fora);
  }, [config]);

  // Nível do microfone no painel de configuração.
  useEffect(() => {
    if (!config) return;
    let raf = 0;
    const passo = () => {
      const el = nivelRef.current;
      if (el) el.style.transform = `scaleX(${Math.min(1, Math.sqrt(pitch.vivo.current.rms) * 1.6)})`;
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [config, pitch.vivo]);

  const alternarMic = () => {
    if (pitch.status === 'ativo') { pitch.desligar(); gravarLS(LS_LIGADO, '0'); }
    else { void pitch.ligar().then(() => setConfig(false)); gravarLS(LS_LIGADO, '1'); }
  };
  const escolherDispositivo = (id: string) => { setDeviceId(id || null); gravarLS(LS_DISPOSITIVO, id || null); };
  const mudarVolume = (v: number) => { setVolumeVoz(v); gravarLS(LS_VOLUME, String(v)); };
  const mudarLatencia = (v: number) => { setLatenciaMs(v); gravarLS(LS_LATENCIA, String(v)); };

  const micLigado = useCallback(() => micRef.current, []);
  const audioRodando = useCallback(() => { const a = audioRef.current; return Boolean(a && !a.paused && !a.ended); }, []);
  const aoTocarAudio = () => {
    if (faseRef.current !== 'cantando') return;
    setTocando(true);
    ultimoQuadroRef.current = -1;
    if (!gravandoRef.current) { iniciarGravacao(msVideo); gravandoRef.current = true; } else pausarGravacao(false);
  };
  const aoPausarAudio = () => { if (faseRef.current !== 'cantando') return; setTocando(false); pausarGravacao(true); };

  // ---------- desenho ----------
  const atual = estado?.atual ?? null;
  const proximo = estado?.fila[0] ?? null;
  const emPalco = fase === 'contagem' || fase === 'cantando';
  const item = emCurso ?? atual;
  const linhasCantadas = useMemo(() => prepararLetra(item?.letra), [item?.letra]);
  const usaLetra = item?.modo === 'letra' && linhasCantadas.length > 0;
  const letraAtiva = fase === 'cantando' && usaLetra;
  const dadosEstudio = useMemo(() => (usaEstudio(emCurso) ? { linhas: emCurso.estudio.palavras.linhas, notas: prepararNotas(emCurso.estudio.notas) } : null), [emCurso]);
  const estudioAtivo = fase === 'cantando' && Boolean(dadosEstudio) && Boolean(emCurso);

  const cartazOcioso = () => {
    if (!estado) return <div className={styles.cartaz}><p className={styles.kicker}>Karaokê</p><p className={styles.subtitulo}>Carregando a fila...</p></div>;
    const alvo = !admin && atual ? atual : proximo;
    return <div className={styles.cartaz}>
      <p className={styles.kicker}>{alvo ? (alvo === atual ? 'Agora' : 'Próximo') : 'Karaokê da família'}</p>
      <div className={styles.proxLinha}>
        <div className={styles.proxTexto}>
          {alvo ? <>
            <p className={styles.titulo}>{quemCanta(alvo)}</p>
            <p className={styles.subtitulo}>{alvo.titulo}</p>
            {alvo.miniatura ? <img className={styles.miniatura} src={alvo.miniatura} alt="" /> : null}
            {estado.fila.length > 1 ? <ul className={styles.proximos}>{estado.fila.slice(1, 4).map((f, i) => <li key={f.id}><b>{i + 2}</b>{quemCanta(f)}: {f.titulo}</li>)}</ul> : null}
          </> : <>
            <p className={styles.titulo}>Quem vai cantar?</p>
            <p className={styles.subtitulo}>Escolha a música no celular e entre na fila.</p>
          </>}
        </div>
        <div className={styles.proxQr}>
          {qr ? <img src={qr} alt="QR code para entrar na fila do karaokê" /> : null}
          <p className={styles.qrTexto}>Entre na fila pelo celular</p>
          <p className={styles.qrLink}>natalemfamilia.com.br/karaoke</p>
        </div>
      </div>
      {estado.ranking.length ? <ul className={styles.rankingMini} aria-label="Melhores notas da noite">{estado.ranking.slice(0, 3).map((r, i) => <li key={r.user_id}>{['1º', '2º', '3º'][i]} {r.nome}<b>{r.melhor}</b></li>)}</ul> : null}
    </div>;
  };

  return <div className={styles.root + (admin ? '' : ` ${styles.semFaixa}`) + (letraAtiva ? ` ${styles.modoLetra}` : '') + (estudioAtivo ? ` ${styles.modoEstudio}` : '')}>
    {letraAtiva && item ? <FundoLetra videoId={item.video_id} /> : null}
    {estudioAtivo && emCurso ? <FundoEstudio capa={emCurso.capa_url} /> : null}
    {admin ? <audio ref={audioRef} preload="auto" onPlaying={aoTocarAudio} onPause={aoPausarAudio} onWaiting={aoPausarAudio} onEnded={() => tratadores.current.finalizar()} onError={() => { if (usaEstudio(emCursoRef.current)) tratadores.current.erroVideo(); }} /> : null}
    <div className={styles.topo}><span className={styles.marca}>Natal em Família · Karaokê</span></div>

    {/* O vídeo do YouTube fica sempre visível enquanto toca (exigência do YouTube); no modo letra só encolhe para o canto. */}
    {admin ? <div ref={caixaRef} className={`${styles.videoCaixa} ${fase === 'cantando' && !estudioAtivo ? '' : styles.videoOculto} ${letraAtiva ? styles.videoPequeno : ''}`} /> : null}

    {letraAtiva && item ? <>
      <div className={styles.letraTopo}>
        <p className={styles.letraCantando}>Cantando: <b>{quemCanta(item)}</b></p>
        <p className={styles.letraMusica}>{item.faixa ?? item.titulo}{item.artista ? ` · ${item.artista}` : ''}</p>
      </div>
      <LetraPalco key={item.id} linhas={linhasCantadas} lerMs={lerMsLetra} />
    </> : null}

    {estudioAtivo && emCurso && dadosEstudio ? <>
      <div className={styles.letraTopo}>
        <p className={styles.letraCantando}>Cantando: <b>{quemCanta(emCurso)}</b></p>
        <p className={styles.letraMusica}>{emCurso.faixa ?? emCurso.titulo}{emCurso.artista ? ` · ${emCurso.artista}` : ''}</p>
      </div>
      <PalcoEstudio key={emCurso.id} linhas={dadosEstudio.linhas} notas={dadosEstudio.notas} lerMs={lerMsLetra} historico={pitch.historico} latenciaRef={latenciaRef} offsetRef={offsetRef} rodando={audioRodando} motor={motorRef} eventos={eventosRef} micAtivo={micLigado} />
    </> : null}

    {admin && (estudioAtivo || letraAtiva) ? <MedidorPlateia key={item?.id} plateia={plateiaRef} ativo={micLigado} /> : null}

    {fase === 'cantando' && item ? <aside className={`${styles.lateral} ${letraAtiva || estudioAtivo ? styles.lateralMini : ''}`}>
      <p className={styles.latKicker}>Agora cantando</p>
      <p className={styles.latNome}>{quemCanta(item)}</p>
      <p className={styles.latMusica}>{item.titulo}</p>
      <div className={styles.medidor}><MedidorAfinacao vivo={pitch.vivo} historico={pitch.historico} /></div>
      <p className={styles.latDica}>{pitch.status === 'ativo' ? 'Verde: no tom. Dourado: quase. Vermelho: fora. A barra ao lado é o volume.' : 'Microfone desligado: esta música fica sem nota.'}</p>
    </aside> : null}

    {admin && emPalco && pitch.status !== 'ativo' ? <p className={styles.semMic}>Microfone desligado: sem nota</p> : null}

    {fase === 'contagem' && item ? <div className={styles.cartaz}>
      <p className={styles.kicker}>Agora</p>
      <p className={styles.titulo}>{quemCanta(item)}</p>
      <p className={styles.subtitulo}>{item.titulo}</p>
      <p className={styles.numero} key={contagem} aria-live="polite">{contagem}</p>
    </div> : null}

    {fase === 'trocando' && item ? <div className={styles.cartaz}>
      <p className={styles.kicker}>Agora</p>
      <p className={styles.titulo}>{quemCanta(item)}</p>
      <p className={styles.subtitulo}>Trocando para outra versão do vídeo...</p>
    </div> : null}

    {fase === 'nota' && resultado ? <NotaCena item={resultado.item} r={resultado.r} posicao={resultado.r && estado ? (() => { const i = estado.ranking.findIndex((x) => x.user_id === resultado.item.user_id); return i >= 0 ? i + 1 : null; })() : null} /> : null}
    {fase === 'ocioso' || fase === 'pulando' ? cartazOcioso() : null}

    {aviso ? <p className={styles.aviso} role="status">{aviso}</p> : null}

    {admin ? <>
      {letraAtiva || estudioAtivo ? <div className={styles.ajusteLetra} role="group" aria-label="Ajustar o tempo da letra">
        <button type="button" className={styles.botao} onClick={() => ajustarLetra(PASSO_OFFSET_MS)} title="A letra aparece antes da voz: atrasa a letra em 0,25 s"><Rewind size={18} aria-hidden="true" />Letra adiantada</button>
        <span className={styles.ajusteValor} aria-live="polite">{formatarOffset(offsetMs)}</span>
        <button type="button" className={styles.botao} onClick={() => ajustarLetra(-PASSO_OFFSET_MS)} title="A letra aparece depois da voz: adianta a letra em 0,25 s"><FastForward size={18} aria-hidden="true" />Letra atrasada</button>
      </div> : null}
      <div className={styles.faixa}>
        {fase === 'ocioso' && (proximo || atual) ? <button type="button" className={`${styles.botao} ${styles.botaoPrincipal}`} onClick={() => { setConfig(false); void iniciar(atual ? undefined : proximo?.id); }}><Play size={18} aria-hidden="true" />Começar</button> : null}
        {fase === 'cantando' ? <button type="button" className={`${styles.botao} ${styles.botaoPrincipal}`} onClick={() => finalizar(true)}><Star size={18} aria-hidden="true" />Encerrar e ver a nota</button> : null}
        {fase === 'cantando' ? <button type="button" className={styles.botao} onClick={alternarPausa}>{tocando ? <><Pause size={18} aria-hidden="true" />Pausar</> : <><Play size={18} aria-hidden="true" />Continuar</>}</button> : null}
        <button type="button" className={styles.botao} disabled={!atual && !proximo} onClick={() => void pular()}><SkipForward size={18} aria-hidden="true" />Pular</button>
        <button ref={botaoMicRef} type="button" className={`${styles.botao} ${pitch.status === 'ativo' ? styles.botaoLigado : ''}`} onClick={() => setConfig((c) => !c)} aria-expanded={config}>{pitch.status === 'ativo' ? <Mic size={18} aria-hidden="true" /> : <MicOff size={18} aria-hidden="true" />}Microfone</button>
        <button type="button" className={`${styles.botao} ${vozNaTv ? styles.botaoLigado : ''}`} onClick={() => { if (!vozNaTv) avisar(AVISO_MICROFONIA); setVozNaTv((v) => !v); if (pitch.status !== 'ativo') void pitch.ligar(); }} aria-pressed={vozNaTv}>{vozNaTv ? <Volume2 size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}Voz na TV</button>
        <button type="button" className={`${styles.botao} ${auto ? styles.botaoLigado : ''}`} onClick={() => setAuto((a) => !a)} aria-pressed={auto}><Repeat size={18} aria-hidden="true" />Passar sozinho</button>
      </div>
      {config ? <div ref={configRef} className={styles.config} role="dialog" aria-label="Configurar microfone">
        <h3>Microfone</h3>
        <label>Dispositivo
          <select value={pitch.ativoId ?? deviceId ?? ''} onChange={(e) => escolherDispositivo(e.target.value)} onFocus={() => void pitch.listar()}>
            <option value="">Padrão do sistema</option>
            {pitch.dispositivos.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
          </select>
        </label>
        <div className={styles.linha}>
          <span>{pitch.status === 'ativo' ? 'Microfone ligado' : pitch.status === 'abrindo' ? 'Abrindo...' : 'Microfone desligado'}</span>
          <button type="button" className={styles.botao} onClick={alternarMic}>{pitch.status === 'ativo' ? 'Desligar' : 'Ligar microfone'}</button>
        </div>
        {pitch.erro ? <p className={styles.erro}>{pitch.erro}</p> : null}
        <div className={styles.nivel} aria-hidden="true"><div ref={nivelRef} className={styles.nivelCheio} /></div>
        <p>Fale ou cante: a barra deve mexer sem encostar no fim.</p>
        <label>Atraso do microfone (versão estúdio): {latenciaMs} ms
          <input type="range" min={0} max={LATENCIA_MAX_MS} step={10} value={latenciaMs} onChange={(e) => mudarLatencia(Number(e.target.value))} />
        </label>
        <p>Se a nota parecer baixa mesmo cantando certo, aumente. O padrão é {LATENCIA_PADRAO_MS} ms.</p>
        <label>Volume da voz na TV
          <input type="range" min={0.1} max={1} step={0.05} value={volumeVoz} onChange={(e) => mudarVolume(Number(e.target.value))} />
        </label>
        <p className={styles.aviso2}>Com a Voz na TV ligada o som das caixas pode voltar para o microfone e apitar (microfonia). {AVISO_MICROFONIA}. Comece com o volume baixo.</p>
      </div> : null}
    </> : <p className={styles.aviso}>Entre com a conta de quem organiza para controlar o karaokê.</p>}
  </div>;
}
