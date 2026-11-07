'use client';
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Camera, CameraOff, FastForward, Mic, MicOff, Pause, Play, Rewind, SkipForward, Star, Volume2, VolumeX, Repeat } from 'lucide-react';
import { api } from '@/app/ui/client';
import { Confete } from '../_confete';
import { CameraFundo, EscolhaFiltros, tirarFoto, useCameraKaraoke, useEfeitos } from './_camera';
import { MedidorAfinacao } from './_medidor';
import { LetraPalco } from './_letra';
import { PalcoEstudio } from './_estudio';
import { MedidorPlateia } from './_plateia';
import { avaliarAtraso, latenciaDaPontuacao, type Avaliacao } from './atraso';
import { Depuracao } from './_depuracao';
import { COMBO_CLIPE, PERFEICAO_FRASE, tocarWhoosh, useMomentos, type CenaMomento, type EstadoMomentos } from './_momentos';
import { ControleEstrela, DetectorGestos, type EventoGesto, type Postura } from './gestos';
import { janelasDaLetra, prepararLetra, type LinhaCantada } from './letra';
import { linhaEstudioEm, linhaLetraEm, type LinhaProgresso } from './momentos';
import { CLAREZA_MINIMA, HZ_MAX, HZ_MIN, LATENCIA_MAX_MS, LATENCIA_PADRAO_MS, PlateiaEnergia, PontuacaoAoVivo, forcaEstudio, forcaLetra, hzParaMidi, limiarDeVozEstudio, pontuar, pontuarEstudio, prepararNotas, useAfinacao, type EventoAoVivo, type Quadro, type Resultado, type ResultadoEstudio } from './_pitch';
import { quemCanta, type DadosEstudio, type EstadoKaraoke, type ItemFila } from './tipos';
import styles from './karaoke.module.css';

const URL_QR = 'https://natalemfamilia.com.br/karaoke';
const CONTAGEM_S = 3;
const NOTA_MS = 15000;
const LS_DISPOSITIVO = 'karaoke.mic.dispositivo';
const LS_LIGADO = 'karaoke.mic.ligado';
const LS_VOLUME = 'karaoke.voz.volume';
const LS_ECO = 'karaoke.mic.eco';
const LS_LATENCIA = 'karaoke.estudio.latencia';
const LS_CAM_LIGADA = 'karaoke.camera.ligada';
const LS_CAM_DISPOSITIVO = 'karaoke.camera.dispositivo';
const LS_CAM_FOTO = 'karaoke.camera.salvarFoto';
const LS_MOMENTOS = 'karaoke.camera.salvarMomentos';
const LS_OFFSET_ESTUDIO = 'karaoke.estudio.offset';
const PASSO_OFFSET_MS = 250;
const OFFSET_MAX_MS = 30000;
const ATRASO_GRAVAR_OFFSET_MS = 400;
/** Erros do IFrame em que o vídeo não toca embutido: tenta outra versão em vez de pular a música. */
const ERROS_TROCAVEIS = [100, 101, 150, 153];
const MAX_TROCAS = 4;
const CONTAGEM_TROCA_S = 3;
/** Câmera: faixa da música em que vale tirar a foto do pico e ponto em que tira se não houve pico. */
const FOTO_DE = 0.3;
const FOTO_ATE = 0.9;
const FOTO_FALLBACK = 0.6;
const FOTO_JANELA_MS = 4000;
const ACERTO_FAISCA = 0.75;
/** Modo letra: fração da linha com voz válida a partir da qual a frase vale foto e clipe (equivale ao PERFEITO do estúdio). */
const FRASE_PERFEITA_LETRA = 0.85;
const ACENO_PAUSA_MS = 3000;
const FRASE_BOA = 0.6;
/** Os botões de baixo somem depois de tanto tempo sem mexer o mouse e voltam ao mexer. */
const OCULTAR_CONTROLES_MS = 3000;

interface FotoNota { url: string; estado: 'enviando' | 'salva' | 'erro' }

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
const DICAS_MICROFONIA = 'Aponte a caixa para longe do microfone; cante de frente para o microfone e de costas para a caixa; comece com a voz na TV baixa.';
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

function NotaCena({ item, r, posicao, foto, momentos }: { item: ItemFila; r: Resultado | null; posicao: number | null; foto: FotoNota | null; momentos: EstadoMomentos | null }) {
  const numero = useNumeroAnimado(r?.nota ?? 0);
  const est = r && 'resumo' in r ? (r as ResultadoEstudio) : null;
  const pontos = useNumeroAnimado(Math.round(est?.total ?? 0));
  return <div className={`${styles.cartaz} ${styles.cartazNota}`}>
    <Confete modo={r && r.estrelas >= 4 ? 'explosao' : 'rajada'} />
    {foto ? <figure className={styles.fotoNota}>
      <img src={foto.url} alt="Foto da apresentação" />
      <figcaption>{foto.estado === 'salva' ? 'Foto salva no álbum' : foto.estado === 'enviando' ? 'Salvando no álbum...' : 'Não consegui salvar no álbum'}</figcaption>
    </figure> : null}
    {momentos && (momentos.fotos.length > 0 || momentos.salvos > 0 || momentos.pendentes > 0) ? <div className={styles.momentosFaixa}>
      {momentos.fotos.length > 0 ? <ul aria-label="Fotos dos melhores momentos">{momentos.fotos.map((f) => <li key={f.chave}><img src={f.url} alt="Foto de um dos melhores momentos" /></li>)}</ul> : null}
      <p className={styles.momentosContagem} aria-live="polite">{momentos.salvos} {momentos.salvos === 1 ? 'momento salvo' : 'momentos salvos'}{momentos.pendentes > 0 ? ' (salvando...)' : ''}</p>
    </div> : null}
    <div className={styles.notaCartao}>
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
        <ul className={styles.notaStats}>
          {est ? <li><b>{pontos.toLocaleString('pt-BR')}</b><span>pontos</span></li> : null}
          {est ? <li><b>{est.resumo.maiorSequencia}</b><span>{est.resumo.maiorSequencia === 1 ? 'nota seguida' : 'notas seguidas'} (x{est.resumo.maiorCombo})</span></li> : null}
          {est ? <li><b>{Math.round(est.resumo.perfeitasPct * 100)}%</b><span>notas perfeitas</span></li> : null}
          {posicao ? <li><b>{posicao}º</b><span>no ranking da noite</span></li> : null}
        </ul>
      </> : <p className={styles.titulo}>Valeu por cantar!</p>}
    </div>
  </div>;
}

export default function KaraokeTelao({ admin }: { admin: boolean }) {
  const [estado, setEstado] = useState<EstadoKaraoke | null>(null);
  const [fase, setFase] = useState<Fase>('ocioso');
  const [contagem, setContagem] = useState(CONTAGEM_S);
  const [resultado, setResultado] = useState<{ item: ItemFila; r: Resultado | null } | null>(null);
  const [aviso, setAviso] = useState('');
  const [config, setConfig] = useState(false);
  const [controlesOcultos, setControlesOcultos] = useState(false);
  const [medindo, setMedindo] = useState(false);
  const [atrasoInfo, setAtrasoInfo] = useState<{ ms: number; medidas: number[]; nova: number; av: Avaliacao; razoes: number[] } | { erro: string } | null>(null);
  const [tocando, setTocando] = useState(false);
  const [auto, setAuto] = useState(true);
  const [vozNaTv, setVozNaTv] = useState(false);
  const [volumeVoz, setVolumeVoz] = useState(() => { const n = Number(lerLS(LS_VOLUME)); return Number.isFinite(n) && n > 0 && n <= 1 ? Math.min(n, 0.5) : 0.4; });
  const [deviceId, setDeviceId] = useState<string | null>(() => lerLS(LS_DISPOSITIVO));
  const [qr, setQr] = useState('');
  const [emCurso, setEmCurso] = useState<ItemFila | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [latenciaMs, setLatenciaMs] = useState(latenciaSalva);
  const [camLigada, setCamLigada] = useState(false);
  const [configCam, setConfigCam] = useState(false);
  const [camDeviceId, setCamDeviceId] = useState<string | null>(() => lerLS(LS_CAM_DISPOSITIVO));
  const [salvarFoto, setSalvarFoto] = useState(() => lerLS(LS_CAM_FOTO) !== '0');
  const [efeitos, setEfeitos] = useEfeitos();
  const [fotoNota, setFotoNota] = useState<FotoNota | null>(null);
  const [salvarMomentos, setSalvarMomentos] = useState(() => lerLS(LS_MOMENTOS) !== '0');
  const [estrelaOn, setEstrelaOn] = useState(false);
  const [dicaEstrela, setDicaEstrela] = useState(false);

  /** Estilo Kinect: detector de gestos, controle do Modo Estrela (libera no x3, 8 s, 1 a cada 45 s) e o tratador do gesto reconhecido. */
  const detectorRef = useRef(new DetectorGestos());
  const estrelaRef = useRef(new ControleEstrela());
  const estrelaAtivaRef = useRef(false);
  const comboRef = useRef(0);
  const acenoAteRef = useRef(0);
  const aoGestoRef = useRef<(g: EventoGesto) => void>(() => undefined);
  const salvarMomentosRef = useRef(true);
  const camAtivaRef = useRef(false);
  const aoPostura = useCallback((posturas: Postura[], agora: number) => {
    for (const g of detectorRef.current.atualizar(agora, posturas)) aoGestoRef.current(g);
  }, []);

  const [cancelarEco, setCancelarEco] = useState(() => lerLS(LS_ECO) !== '0');
  const avisarRef = useRef<(texto: string) => void>(() => undefined);
  const pitch = useAfinacao(deviceId, { vozNaTv, volumeVoz, cancelarEco, aoRetorno: (m) => avisarRef.current(m) });
  const { iniciarGravacao, pausarGravacao, pararGravacao, retomar, ligar, definirOuvinte, definirModoEstudio } = pitch;
  /** Volume (0..1) do microfone para a câmera saber quem canta: só conta acima do limiar de voz. */
  const volumeCamera = useCallback(() => { const v = pitch.vivo.current; return v.rms > v.limiar ? Math.min(1, Math.sqrt(v.rms) * 1.6) : 0; }, [pitch.vivo]);
  const cam = useCameraKaraoke({ ligada: admin && camLigada, deviceId: camDeviceId ?? undefined, volume: volumeCamera, pose: admin && camLigada && fase !== 'nota', aoPostura });
  const camAtiva = admin && camLigada && cam.pronta;

  const caixaRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const latenciaRef = useRef(LATENCIA_PADRAO_MS);
  /** Pontuação ao vivo da música em modo estúdio, fila de acontecimentos para a tela, energia da plateia e linhas da letra (modo letra). */
  const motorRef = useRef<PontuacaoAoVivo | null>(null);
  /** Contadores de depuração (só com ?debug=1): expostos em window.__karaoke. */
  const depRef = useRef<Depuracao | null>(null);
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
  const configCamRef = useRef<HTMLDivElement>(null);
  const botaoCamRef = useRef<HTMLButtonElement>(null);
  const canvasCamRef = useRef<HTMLCanvasElement>(null);
  /** Acertos que soltam faíscas na câmera, foto candidata da música em andamento e o acompanhamento das frases (modo letra). */
  const faiscasRef = useRef(0);
  const fotoRef = useRef<{ id: number; blob: Blob } | null>(null);
  const fotoUrlRef = useRef<string | null>(null);
  const fraseRef = useRef({ i: -1, total: 0, bons: 0 });
  const botaoMicRef = useRef<HTMLButtonElement>(null);
  /** Ajuste da letra (ms) da música em andamento; vale na hora e é gravado depois de uma pequena espera. */
  const offsetRef = useRef(0);
  const timerOffset = useRef<number | undefined>(undefined);
  const relogioRef = useRef({ v: 0, w: 0, saida: 0 });
  const trocasRef = useRef<Map<number, number>>(new Map());

  useEffect(() => { autoRef.current = auto; micRef.current = pitch.status === 'ativo'; latenciaRef.current = latenciaMs; salvarMomentosRef.current = salvarMomentos; camAtivaRef.current = camAtiva; });

  const definirEmCurso = useCallback((i: ItemFila | null) => { emCursoRef.current = i; setEmCurso(i); }, []);
  const mudarFase = useCallback((f: Fase) => { faseRef.current = f; setFase(f); if (f !== 'ocioso') setConfig(false); }, []);
  const avisar = useCallback((texto: string) => {
    setAviso(texto);
    window.clearTimeout(timerAviso.current);
    timerAviso.current = window.setTimeout(() => setAviso(''), 6000);
  }, []);
  useEffect(() => { avisarRef.current = avisar; }, [avisar]);

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

  /** O que o vídeo dos melhores momentos desenha por cima da câmera: letra da vez, placar, sequência, cantor e Modo Estrela. */
  const lerCena = useCallback((): CenaMomento | null => {
    const it = emCursoRef.current;
    if (!it || faseRef.current !== 'cantando') return null;
    const ms = lerMsLetra();
    let linha: LinhaProgresso | null = null;
    if (usaEstudio(it)) linha = linhaEstudioEm(it.estudio.palavras.linhas, ms);
    else if (it.modo === 'letra') linha = linhaLetraEm(linhasLetraRef.current, ms);
    const e = motorRef.current?.estado() ?? null;
    return {
      cantor: quemCanta(it), musica: it.faixa ?? it.titulo, linha, pontos: e ? e.pontos : null,
      combo: e ? e.combo : 1, sequencia: e ? e.sequencia : 0, estrelaMs: estrelaRef.current.restanteMs(performance.now()),
    };
  }, [lerMsLetra]);
  const momentos = useMomentos({
    obterMic: pitch.obterStream,
    vozAtiva: () => pitch.vivo.current.cantando,
    ecoAtivo: () => ecoRef.current,
    audio: () => (usaEstudio(emCursoRef.current) ? audioRef.current : null),
    lerCena,
    fonte: () => canvasCamRef.current,
  });
  const { encerrar: encerrarMomentos, gatilho: gatilhoMomento, iniciar: iniciarMomentos } = momentos;
  /** Começa a gravar os melhores momentos quando o som da música começa (estúdio e letra; só se a opção estiver ligada). */
  const comecarMomentos = useCallback(() => {
    const it = emCursoRef.current;
    if (!it || !salvarMomentosRef.current || (it.modo !== 'estudio' && it.modo !== 'letra')) return;
    iniciarMomentos(it.id, usaEstudio(it));
  }, [iniciarMomentos]);

  const limparTimers = useCallback(() => {
    window.clearInterval(timerContagem.current); window.clearTimeout(timerNota.current); window.clearInterval(timerEspera.current);
  }, []);

  const abortar = useCallback(() => {
    limparTimers();
    try { playerRef.current?.stopVideo(); } catch { /* player ainda não pronto */ }
    audioRef.current?.pause();
    pararGravacao(); gravandoRef.current = false;
    if (emCursoRef.current) void encerrarMomentos(emCursoRef.current.id);
    definirEmCurso(null);
    setTocando(false);
    mudarFase('ocioso');
  }, [limparTimers, definirEmCurso, mudarFase, pararGravacao, encerrarMomentos]);

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

  const limparFoto = useCallback(() => {
    if (fotoUrlRef.current) { URL.revokeObjectURL(fotoUrlRef.current); fotoUrlRef.current = null; }
    setFotoNota(null);
  }, []);

  /** Mostra a foto na tela da nota na hora e a envia ao álbum (2 tentativas); só depois da nota gravada. */
  const enviarFoto = useCallback(async (foto: { id: number; blob: Blob }, nota: number | null) => {
    const local = URL.createObjectURL(foto.blob);
    fotoUrlRef.current = local;
    setFotoNota({ url: local, estado: 'enviando' });
    let enviou = false;
    for (let i = 0; i < 2 && !enviou; i++) {
      if (i > 0) await esperar(INTERVALO_PATCH_MS);
      try {
        const fd = new FormData();
        fd.append('fila_id', String(foto.id));
        if (nota !== null) fd.append('nota', String(nota));
        fd.append('foto', foto.blob, 'karaoke.jpg');
        enviou = (await fetch('/api/karaoke/foto', { method: 'POST', body: fd })).ok;
      } catch { enviou = false; }
    }
    if (fotoUrlRef.current === local) setFotoNota({ url: local, estado: enviou ? 'salva' : 'erro' });
  }, []);

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
    estrelaRef.current.novaMusica(); detectorRef.current.reiniciar(); comboRef.current = 0; estrelaAtivaRef.current = false; setEstrelaOn(false); setDicaEstrela(false);
    fotoRef.current = null; fraseRef.current = { i: -1, total: 0, bons: 0 };
    limparFoto();
    definirModoEstudio(usaEstudio(item));
    depRef.current = usaEstudio(item) && new URLSearchParams(window.location.search).get('debug') === '1'
      ? new Depuracao(prepararNotas(item.estudio.notas), latenciaRef.current, offsetRef.current) : null;
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
  }, [limparTimers, definirEmCurso, mudarFase, tocar, definirModoEstudio, limparFoto]);

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
    limparFoto();
    mudarFase('ocioso');
    if (autoRef.current && (estadoRef.current?.fila.length ?? 0) > 0) void iniciar();
  }, [iniciar, definirEmCurso, mudarFase, limparFoto]);

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
    void encerrarMomentos(item.id);
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
    const foto = fotoRef.current?.id === item.id ? fotoRef.current : null;
    fotoRef.current = null;
    void acaoComRetentativa({ acao: 'terminar', id: item.id, ...(r ? { nota: r.nota, estrelas: r.estrelas, detalhes: r.detalhes } : {}) }).then(() => {
      if (foto) void enviarFoto(foto, r ? r.nota : null);
    });
  }, [acaoComRetentativa, enviarFoto, encerrarMomentos, mudarFase, pararGravacao, sairDaNota]);

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
      void encerrarMomentos(item.id);
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
  }, [abortar, acao, acaoComRetentativa, avisar, encerrarMomentos, entrarContagem, iniciar, limparTimers, mudarFase, pararGravacao]);

  useEffect(() => { tratadores.current = { finalizar, erroVideo }; }, [finalizar, erroVideo]);

  // Gestos do estilo Kinect: braços para cima na música (Modo Estrela) e acenar para começar.
  useEffect(() => {
    aoGestoRef.current = (g: EventoGesto) => {
      const agora = performance.now();
      if (g === 'estrela') {
        const it = emCursoRef.current;
        const motor = motorRef.current;
        if (faseRef.current !== 'cantando' || !motor || !usaEstudio(it)) return;
        if (!estrelaRef.current.ativar(agora)) return;
        const ms = msVideo();
        motor.iniciarEstrela(ms);
        estrelaAtivaRef.current = true;
        setEstrelaOn(true); setDicaEstrela(false);
        faiscasRef.current += 5;
        tocarWhoosh();
        gatilhoMomento('estrela', ms);
        return;
      }
      if (agora < acenoAteRef.current) return;
      const f = faseRef.current;
      if (f === 'ocioso') {
        const e = estadoRef.current;
        const alvo = e?.atual ?? e?.fila[0];
        if (!alvo || ocupadoRef.current) return;
        acenoAteRef.current = agora + ACENO_PAUSA_MS;
        void iniciar(e?.atual ? undefined : alvo.id);
      } else if (f === 'contagem') {
        const it = emCursoRef.current;
        if (!it) return;
        acenoAteRef.current = agora + ACENO_PAUSA_MS;
        window.clearInterval(timerContagem.current);
        tocar(it);
      }
    };
  }, [msVideo, gatilhoMomento, iniciar, tocar]);

  // Estado de baixa frequência do Modo Estrela (efeito dourado na tela e dica "Levante os braços").
  useEffect(() => {
    if (!admin) return;
    const t = window.setInterval(() => {
      const agora = performance.now();
      const c = estrelaRef.current;
      const noPalco = faseRef.current === 'cantando';
      const ativa = noPalco && c.ativa(agora);
      if (!ativa) estrelaAtivaRef.current = false;
      setEstrelaOn(ativa);
      setDicaEstrela(noPalco && camAtivaRef.current && Boolean(motorRef.current) && c.disponivel(agora));
    }, 250);
    return () => window.clearInterval(t);
  }, [admin]);

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
              comecarMomentos();
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
  }, [admin, iniciarGravacao, pausarGravacao, msVideo, comecarMomentos]);

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
        const midiQ = emFaixa ? hzParaMidi(q.hz) : null;
        const ev = motor.adicionarQuadro(q.m, midiQ, q.clareza, q.rms, dt);
        depRef.current?.registrar({ t: q.t, m: q.m, midi: midiQ, valido: motor.ultimoQuadro.valido, indice: motor.ultimoQuadro.indice, clareza: q.clareza, rms: q.rms, dt });
        if (ev.length) {
          for (const e of ev) {
            if (e.tipo === 'nota') {
              if (e.razao >= ACERTO_FAISCA) faiscasRef.current++;
              estrelaRef.current.registrarCombo(e.combo);
              // Sequência chegando a x3 ou x4: clipe.
              if (e.combo >= COMBO_CLIPE && e.combo > comboRef.current) gatilhoMomento('combo', q.m);
              comboRef.current = e.combo;
            } else if (e.tipo === 'linha' && e.perfeicao >= PERFEICAO_FRASE) gatilhoMomento('frase', q.m);
          }
          const fila = eventosRef.current;
          fila.push(...ev);
          if (fila.length > 300) fila.splice(0, fila.length - 300);
        }
        plateiaRef.current.atualizar(dt, forcaEstudio(motor.ultimoQuadro));
      } else if (atualEm.modo === 'letra' && typeof q.m === 'number') {
        const t = q.m - offsetRef.current;
        const linhaIdx = linhasLetraRef.current.findIndex((l) => t >= l.ini && t < l.janelaFim);
        const dentro = linhaIdx >= 0;
        const vozValida = q.clareza >= CLAREZA_MINIMA && q.rms > limiar && emFaixa;
        // Frase boa: ao sair de uma linha em que a voz válida cobriu a maior parte dela, soltam-se faíscas.
        const fr = fraseRef.current;
        if (linhaIdx !== fr.i) {
          if (fr.i >= 0 && fr.total >= 5 && fr.bons / fr.total >= FRASE_BOA) faiscasRef.current++;
          if (fr.i >= 0 && fr.total >= 5 && fr.bons / fr.total >= FRASE_PERFEITA_LETRA) gatilhoMomento('frase', q.m);
          fr.i = linhaIdx; fr.total = 0; fr.bons = 0;
        }
        if (dentro) { fr.total++; if (vozValida) fr.bons++; }
        plateiaRef.current.atualizar(dt, forcaLetra(dentro, vozValida));
      }
    });
    return () => definirOuvinte(null);
  }, [definirOuvinte, gatilhoMomento]);

  // Câmera: religa sozinha se estava ligada (o navegador já guarda a permissão).
  useEffect(() => {
    if (!admin || lerLS(LS_CAM_LIGADA) !== '1') return;
    const t = window.setTimeout(() => setCamLigada(true), 0);
    return () => window.clearTimeout(t);
  }, [admin]);

  // Foto automática: o momento de maior ganho de pontos na faixa de 30% a 90% da música (estúdio) ou, na falta de pico, aos 60%.
  const emCursoFotoId = emCurso?.id;
  useEffect(() => {
    if (!camAtiva || !salvarFoto || fase !== 'cantando' || !emCursoFotoId) return;
    const historico: { t: number; p: number }[] = [];
    let melhor = 0;
    let capturando = false;
    const t = window.setInterval(() => {
      const atualEm = emCursoRef.current;
      const canvas = canvasCamRef.current;
      if (!atualEm || !canvas || capturando || cam.rostosRef.current.length === 0) return;
      const estudio = usaEstudio(atualEm);
      let pos = 0; let dur = 0; let rodando = false;
      if (estudio) { const a = audioRef.current; pos = a?.currentTime ?? 0; dur = a?.duration ?? 0; rodando = Boolean(a && !a.paused && !a.ended); }
      else {
        const p = playerRef.current;
        if (!p || !prontoRef.current) return;
        try { pos = p.getCurrentTime(); dur = p.getDuration(); rodando = p.getPlayerState() === PLAYING; } catch { return; }
      }
      if (!rodando || !(dur > 0) || !Number.isFinite(dur)) return;
      const frac = pos / dur;
      if (frac < FOTO_DE || frac > FOTO_ATE) return;
      let quer = false;
      const e = estudio ? motorRef.current?.estado() : undefined;
      if (e) {
        const agora = performance.now();
        historico.push({ t: agora, p: e.pontos });
        while (historico.length > 1 && agora - historico[0].t > FOTO_JANELA_MS) historico.shift();
        const ritmo = e.pontos - historico[0].p;
        if (ritmo > melhor) { melhor = ritmo; quer = true; }
      }
      if (!quer && !fotoRef.current && frac >= FOTO_FALLBACK) quer = true;
      if (!quer) return;
      capturando = true;
      void tirarFoto(canvas).then((blob) => {
        if (blob && emCursoRef.current?.id === atualEm.id && faseRef.current === 'cantando') fotoRef.current = { id: atualEm.id, blob };
      }).catch(() => undefined).finally(() => { capturando = false; });
    }, 500);
    return () => window.clearInterval(t);
  }, [camAtiva, salvarFoto, fase, emCursoFotoId, cam.rostosRef]);

  // Depuração (só com ?debug=1): contadores do modo estúdio em window.__karaoke.estado().
  const infoAudio = pitch.infoAudio;
  const lerAntiMic = pitch.lerAntiMic;
  const ecoRef = useRef<boolean | null>(null);
  useEffect(() => { ecoRef.current = pitch.ecoAtivo; });
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('debug') !== '1') return;
    const w = window as unknown as { __karaoke?: { estado: () => unknown } };
    w.__karaoke = {
      estado: () => {
        const d = depRef.current;
        if (d) { d.info = infoAudio.current; d.latenciaMs = latenciaRef.current; d.offsetMs = offsetRef.current; }
        return { ...(d?.estado() ?? {}), antiMic: lerAntiMic(), eco: ecoRef.current, placar: motorRef.current?.estado() ?? null, fase: faseRef.current, offsetMs: offsetRef.current, latenciaMs: latenciaRef.current };
      },
    };
    return () => { delete w.__karaoke; };
  }, [infoAudio, lerAntiMic]);

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

  // Tela limpa: tira o grão de filme global (body::after) enquanto o karaokê está aberto.
  useEffect(() => {
    document.body.dataset.telaLimpa = '1';
    return () => { delete document.body.dataset.telaLimpa; };
  }, []);

  // Botões de baixo: somem com o mouse parado (e o cursor com eles) e voltam ao mexer. Com um painel aberto ficam.
  const painelAbertoRef = useRef(false);
  useEffect(() => { painelAbertoRef.current = config || configCam; });
  useEffect(() => {
    if (!admin) return;
    let timer = 0;
    const agendar = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { if (painelAbertoRef.current) agendar(); else setControlesOcultos(true); }, OCULTAR_CONTROLES_MS);
    };
    const mostrar = () => { setControlesOcultos(false); agendar(); };
    agendar();
    const eventos = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    for (const e of eventos) window.addEventListener(e, mostrar, { passive: true });
    return () => { window.clearTimeout(timer); for (const e of eventos) window.removeEventListener(e, mostrar); };
  }, [admin]);

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

  // O painel da câmera também fecha ao clicar fora dele.
  useEffect(() => {
    if (!configCam) return;
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node | null;
      if (alvo && (configCamRef.current?.contains(alvo) || botaoCamRef.current?.contains(alvo))) return;
      setConfigCam(false);
    };
    document.addEventListener('pointerdown', fora);
    return () => document.removeEventListener('pointerdown', fora);
  }, [configCam]);

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
  const mudarEco = (ligado: boolean) => { setCancelarEco(ligado); gravarLS(LS_ECO, ligado ? '1' : '0'); };
  const mudarLatencia = (v: number) => { setLatenciaMs(v); gravarLS(LS_LATENCIA, String(v)); };
  /** Mede o atraso total da Voz na TV (pulso pelas caixas, gravado pelo microfone) e calibra o atraso da pontuação com ele. */
  const medirAtraso = async () => {
    setMedindo(true); setAtrasoInfo(null);
    try {
      const r = await pitch.medirAtraso();
      if (r.inconsistente) { setAtrasoInfo({ erro: `As 3 medidas não bateram (${r.medidas.map((m) => `${Math.round(m)} ms`).join(', ')}; nitidez ${r.razoes.map((x) => `${x}x`).join(', ')}): tem barulho na sala ou o pulso não chegou ao microfone. Aumente o volume da TV, aproxime o microfone das caixas e tente de novo.` }); return; }
      if (r.atrasoMs === null) { setAtrasoInfo({ erro: 'Não ouvi o pulso: aumente o volume da TV, aproxime o microfone das caixas e tente de novo.' }); return; }
      const av = avaliarAtraso(r.atrasoMs);
      const nova = latenciaDaPontuacao(r.atrasoMs);
      mudarLatencia(nova);
      setAtrasoInfo({ ms: r.atrasoMs, medidas: r.medidas, nova, av, razoes: r.razoes });
      if (av.nivel === 'alto' && vozNaTv) avisar('Atraso da voz alto: desligue a Voz na TV.');
    } catch (e) {
      setAtrasoInfo({ erro: (e as Error).message || 'Não consegui medir o atraso.' });
    } finally {
      setMedindo(false);
    }
  };
  const botaoCamera = () => {
    setConfig(false);
    if (!camLigada) { setCamLigada(true); gravarLS(LS_CAM_LIGADA, '1'); setConfigCam(true); } else setConfigCam((c) => !c);
  };
  const desligarCamera = () => { setCamLigada(false); setConfigCam(false); gravarLS(LS_CAM_LIGADA, '0'); };
  const escolherCamera = (id: string) => { setCamDeviceId(id || null); gravarLS(LS_CAM_DISPOSITIVO, id || null); };
  const mudarSalvarFoto = (v: boolean) => { setSalvarFoto(v); gravarLS(LS_CAM_FOTO, v ? '1' : '0'); };
  const mudarSalvarMomentos = (v: boolean) => { setSalvarMomentos(v); gravarLS(LS_MOMENTOS, v ? '1' : '0'); };

  const micLigado = useCallback(() => micRef.current, []);
  const audioRodando = useCallback(() => { const a = audioRef.current; return Boolean(a && !a.paused && !a.ended); }, []);
  const aoTocarAudio = () => {
    if (faseRef.current !== 'cantando') return;
    setTocando(true);
    ultimoQuadroRef.current = -1;
    if (!gravandoRef.current) { iniciarGravacao(msVideo); gravandoRef.current = true; } else pausarGravacao(false);
    comecarMomentos();
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

  const nomesNaTela = emCurso ? (emCurso.dueto_nome ? [emCurso.nome, emCurso.dueto_nome] : [emCurso.nome, emCurso.nome]) : [];

  return <div className={styles.root + (admin ? '' : ` ${styles.semFaixa}`) + (camAtiva ? ` ${styles.camAtiva}` : '') + (letraAtiva ? ` ${styles.modoLetra}` : '') + (estudioAtivo ? ` ${styles.modoEstudio}` : '') + (controlesOcultos ? ` ${styles.controlesOcultos}` : '')}>
    {camAtiva ? <>
      <CameraFundo video={cam.video} rostos={cam.rostosRef} cantandoIdx={cam.cantandoRef} nomes={nomesNaTela} efeitos={efeitos} faiscas={faiscasRef} estrela={estrelaAtivaRef} canvasRef={canvasCamRef} />
      {letraAtiva || estudioAtivo ? <div className={styles.camFaixaLetra} aria-hidden="true" /> : null}
    </> : null}
    {admin ? <audio ref={audioRef} preload="auto" onPlaying={aoTocarAudio} onPause={aoPausarAudio} onWaiting={aoPausarAudio} onEnded={() => tratadores.current.finalizar()} onError={() => { if (usaEstudio(emCursoRef.current)) tratadores.current.erroVideo(); }} /> : null}
    <div className={styles.topo}><span className={styles.marca}>Natal em Família · Karaokê</span></div>
    {estrelaOn ? <p className={styles.estrelaBanner} role="status">MODO ESTRELA x2</p> : null}
    {dicaEstrela && !estrelaOn ? <p className={styles.dicaEstrela}>Levante os braços para o Modo Estrela!</p> : null}

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

    {fase === 'contagem' && item ? <div className={`${styles.cartaz} ${styles.cartazContagem}`}>
      <p className={styles.kicker}>Prepare-se</p>
      <p className={styles.titulo}>{quemCanta(item)}</p>
      <p className={styles.subtitulo}>{item.titulo}</p>
      <div className={styles.contagemRoda} key={contagem}>
        <svg viewBox="0 0 100 100" className={styles.contagemAnel} aria-hidden="true"><circle cx="50" cy="50" r="46" pathLength="100" /></svg>
        <span className={styles.numero} aria-live="polite">{contagem}</span>
      </div>
    </div> : null}

    {fase === 'trocando' && item ? <div className={styles.cartaz}>
      <p className={styles.kicker}>Agora</p>
      <p className={styles.titulo}>{quemCanta(item)}</p>
      <p className={styles.subtitulo}>Trocando para outra versão do vídeo...</p>
    </div> : null}

    {fase === 'nota' && resultado ? <NotaCena foto={fotoNota} momentos={momentos.estado?.filaId === resultado.item.id ? momentos.estado : null} item={resultado.item} r={resultado.r} posicao={resultado.r && estado ? (() => { const i = estado.ranking.findIndex((x) => x.user_id === resultado.item.user_id); return i >= 0 ? i + 1 : null; })() : null} /> : null}
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
        <button ref={botaoMicRef} type="button" className={`${styles.botao} ${pitch.status === 'ativo' ? styles.botaoLigado : ''}`} onClick={() => { setConfigCam(false); setConfig((c) => !c); }} aria-expanded={config}>{pitch.status === 'ativo' ? <Mic size={18} aria-hidden="true" /> : <MicOff size={18} aria-hidden="true" />}Microfone</button>
        <button type="button" className={`${styles.botao} ${vozNaTv ? styles.botaoLigado : ''}`} onClick={() => { if (!vozNaTv) avisar(AVISO_MICROFONIA); setVozNaTv((v) => !v); if (pitch.status !== 'ativo') void pitch.ligar(); }} aria-pressed={vozNaTv}>{vozNaTv ? <Volume2 size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}Voz na TV</button>
        <button ref={botaoCamRef} type="button" className={`${styles.botao} ${camLigada ? styles.botaoLigado : ''}`} onClick={botaoCamera} aria-expanded={configCam}>{camLigada ? <Camera size={18} aria-hidden="true" /> : <CameraOff size={18} aria-hidden="true" />}Câmera</button>
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
        <div className={styles.linha}>
          <span>{atrasoInfo && 'ms' in atrasoInfo ? `Atraso total: ${Math.round(atrasoInfo.ms)} ms` : 'Atraso da voz nas caixas'}</span>
          <button type="button" className={styles.botao} onClick={() => void medirAtraso()} disabled={pitch.status !== 'ativo' || medindo}>{medindo ? 'Medindo...' : 'Medir atraso'}</button>
        </div>
        {atrasoInfo && 'erro' in atrasoInfo ? <p className={styles.erro}>{atrasoInfo.erro}</p> : null}
        {atrasoInfo && 'ms' in atrasoInfo ? <>
          <p>Medidas: {atrasoInfo.medidas.map((m) => `${Math.round(m)} ms`).join(', ')} (nitidez do pulso {atrasoInfo.razoes.map((x) => `${x}x`).join(', ')}). Atraso do microfone da pontuação ajustado para {atrasoInfo.nova} ms.</p>
          <p className={atrasoInfo.av.nivel === 'bom' ? undefined : styles.aviso2}>{atrasoInfo.av.texto}{atrasoInfo.av.nivel === 'alto' && !vozNaTv ? ' (A Voz na TV já está desligada.)' : ''}</p>
        </> : null}
        {pitch.infoMonitor ? <p>Monitoração: {Math.round(pitch.infoMonitor.taxa)} Hz, buffer {pitch.infoMonitor.baseMs} ms, saída {pitch.infoMonitor.saidaMs} ms. {pitch.infoMonitor.separado ? 'Microfone cru separado (sem eco), a nota segue no microfone com eco.' : 'O Chrome não separou o microfone: a monitoração usa o mesmo fluxo da nota.'}</p> : null}
        <label className={styles.linhaCheck}>
          <input type="checkbox" checked={cancelarEco} onChange={(e) => mudarEco(e.target.checked)} />
          Cancelar eco da TV
        </label>
        <p data-eco={pitch.status === 'ativo' ? String(pitch.ecoAtivo) : 'fechado'}>{pitch.status !== 'ativo'
          ? 'O navegador confirma aqui se o cancelamento de eco está valendo quando o microfone liga.'
          : pitch.ecoAtivo === true ? 'Eco: ativo de fato (confirmado pelo navegador).'
            : pitch.ecoAtivo === false ? (cancelarEco ? 'Eco: pedido, mas o navegador NÃO ativou neste microfone.' : 'Eco: desligado.')
              : 'Eco: o navegador não informou o estado.'}</p>
        <label>Volume da voz na TV
          <input type="range" min={0.1} max={1} step={0.05} value={volumeVoz} onChange={(e) => mudarVolume(Number(e.target.value))} />
        </label>
        <div className={styles.linha}>
          <span>Anti-microfonia: {pitch.antiMic.cortes} {pitch.antiMic.cortes === 1 ? 'corte ativo' : 'cortes ativos'}{pitch.antiMic.reducaoDb > 0 ? `, voz ${pitch.antiMic.reducaoDb} dB mais baixa` : ''}</span>
          <button type="button" className={styles.botao} onClick={pitch.resetarAntiMicrofonia} disabled={pitch.status !== 'ativo' || (pitch.antiMic.cortes === 0 && pitch.antiMic.reducaoDb === 0)}>Resetar anti-microfonia</button>
        </div>
        <p>{DICAS_MICROFONIA}</p>
        <p className={styles.aviso2}>Com a Voz na TV ligada o som das caixas pode voltar para o microfone e apitar (microfonia). {AVISO_MICROFONIA}. Comece com o volume baixo.</p>
      </div> : null}
      {configCam ? <div ref={configCamRef} className={styles.config} role="dialog" aria-label="Configurar câmera">
        <h3>Câmera</h3>
        <div className={styles.linha}>
          <span>{cam.erro ? 'Com problema' : cam.pronta ? 'Câmera ligada' : camLigada ? 'Abrindo...' : 'Câmera desligada'}</span>
          <button type="button" className={styles.botao} onClick={camLigada ? desligarCamera : botaoCamera}>{camLigada ? 'Desligar' : 'Ligar câmera'}</button>
        </div>
        {cam.erro ? <p className={styles.erro}>{cam.erro}</p> : null}
        <label>Dispositivo
          <select value={camDeviceId ?? ''} onChange={(e) => escolherCamera(e.target.value)}>
            <option value="">Padrão do sistema</option>
            {cam.dispositivos.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
          </select>
        </label>
        <p>Filtros de Natal</p>
        <EscolhaFiltros valor={efeitos} onMudar={setEfeitos} />
        <label className={styles.linhaCheck}>
          <input type="checkbox" checked={salvarFoto} onChange={(e) => mudarSalvarFoto(e.target.checked)} />
          Salvar foto no álbum
        </label>
        <p>Tira uma foto no melhor momento da música e guarda no álbum da família.</p>
        <label className={styles.linhaCheck}>
          <input type="checkbox" checked={salvarMomentos} onChange={(e) => mudarSalvarMomentos(e.target.checked)} />
          Salvar momentos
        </label>
        <p>Grava clipes e fotos das frases perfeitas, das sequências x3 e x4 e do Modo Estrela, e mostra no celular de todos. Com a câmera ligada, levante os braços para ativar o Modo Estrela (pontos em dobro por 8 s) e acene para começar.</p>
      </div> : null}
    </> : <p className={styles.aviso}>Entre com a conta de quem organiza para controlar o karaokê.</p>}
  </div>;
}
