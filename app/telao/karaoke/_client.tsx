'use client';
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Mic, MicOff, Pause, Play, SkipForward, Star, Volume2, VolumeX, Repeat } from 'lucide-react';
import { api } from '@/app/ui/client';
import { Confete } from '../_confete';
import { MedidorAfinacao } from './_medidor';
import { pontuar, useAfinacao, type Resultado } from './_pitch';
import { quemCanta, type EstadoKaraoke, type ItemFila } from './tipos';
import styles from './karaoke.module.css';

const URL_QR = 'https://natalemfamilia.com.br/karaoke';
const CONTAGEM_S = 5;
const NOTA_MS = 15000;
const LS_DISPOSITIVO = 'karaoke.mic.dispositivo';
const LS_LIGADO = 'karaoke.mic.ligado';
const LS_VOLUME = 'karaoke.voz.volume';

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

type Fase = 'ocioso' | 'contagem' | 'cantando' | 'nota' | 'pulando';

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

function NotaCena({ item, r }: { item: ItemFila; r: Resultado | null }) {
  const numero = useNumeroAnimado(r?.nota ?? 0);
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

  const pitch = useAfinacao(deviceId, { vozNaTv, volumeVoz });
  const { iniciarGravacao, pausarGravacao, pararGravacao, retomar, ligar } = pitch;

  const caixaRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
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
  const tratadores = useRef<{ finalizar: () => void; erroVideo: () => void }>({ finalizar: () => undefined, erroVideo: () => undefined });
  const nivelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { autoRef.current = auto; micRef.current = pitch.status === 'ativo'; });

  const definirEmCurso = useCallback((i: ItemFila | null) => { emCursoRef.current = i; setEmCurso(i); }, []);
  const mudarFase = useCallback((f: Fase) => { faseRef.current = f; setFase(f); }, []);
  const avisar = useCallback((texto: string) => {
    setAviso(texto);
    window.clearTimeout(timerAviso.current);
    timerAviso.current = window.setTimeout(() => setAviso(''), 6000);
  }, []);

  const limparTimers = useCallback(() => {
    window.clearInterval(timerContagem.current); window.clearTimeout(timerNota.current); window.clearInterval(timerEspera.current);
  }, []);

  const abortar = useCallback(() => {
    limparTimers();
    try { playerRef.current?.stopVideo(); } catch { /* player ainda não pronto */ }
    pararGravacao(); gravandoRef.current = false;
    definirEmCurso(null);
    setTocando(false);
    mudarFase('ocioso');
  }, [limparTimers, definirEmCurso, mudarFase, pararGravacao]);

  const tocar = useCallback((item: ItemFila) => {
    const comecar = () => { mudarFase('cantando'); playerRef.current?.loadVideoById(item.video_id); };
    if (playerRef.current && prontoRef.current) { comecar(); return; }
    window.clearInterval(timerEspera.current);
    timerEspera.current = window.setInterval(() => {
      if (playerRef.current && prontoRef.current) { window.clearInterval(timerEspera.current); comecar(); }
    }, 300);
  }, [mudarFase]);

  const entrarContagem = useCallback((item: ItemFila) => {
    limparTimers();
    definirEmCurso(item);
    gravandoRef.current = false;
    setResultado(null); setContagem(CONTAGEM_S);
    mudarFase('contagem');
    let n = CONTAGEM_S;
    timerContagem.current = window.setInterval(() => {
      n -= 1;
      if (n <= 0) { window.clearInterval(timerContagem.current); tocar(item); } else setContagem(n);
    }, 1000);
  }, [limparTimers, definirEmCurso, mudarFase, tocar]);

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
      const novo = await api<EstadoKaraoke>('/api/karaoke/fila');
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
    const tocouMs = antes ? (playerRef.current?.getCurrentTime() || 0) * 1000 : 0;
    if (antes) playerRef.current?.pauseVideo();
    ignoradosRef.current.add(item.id);
    const quadros = pararGravacao();
    gravandoRef.current = false;
    setTocando(false);
    const duracao = antes && tocouMs > 0 ? tocouMs : (playerRef.current?.getDuration() || item.duracao_s || 0) * 1000;
    const r = micRef.current && quadros.length > 60 && duracao > 0 ? pontuar(quadros, duracao) : null;
    setResultado({ item, r });
    mudarFase('nota');
    window.clearTimeout(timerNota.current);
    timerNota.current = window.setTimeout(sairDaNota, NOTA_MS);
    void acaoComRetentativa({ acao: 'terminar', id: item.id, ...(r ? { nota: r.nota, estrelas: r.estrelas, detalhes: r.detalhes } : {}) });
  }, [acaoComRetentativa, mudarFase, pararGravacao, sairDaNota]);

  const erroVideo = useCallback(() => {
    const item = emCursoRef.current;
    if (!item) return;
    // Id falho nunca reabre contagem; a fase 'pulando' segura tudo até o PATCH de pular terminar.
    ignoradosRef.current.add(item.id);
    avisar('Esse vídeo não pode ser tocado aqui. Passando para o próximo.');
    abortar();
    mudarFase('pulando');
    window.setTimeout(() => {
      void acaoComRetentativa({ acao: 'pular', id: item.id }).then(() => {
        if (faseRef.current === 'pulando') mudarFase('ocioso');
        if (autoRef.current && (estadoRef.current?.fila.filter((f) => f.id !== item.id).length ?? 0) > 0) void iniciar();
      });
    }, 2500);
  }, [abortar, acaoComRetentativa, avisar, iniciar, mudarFase]);

  useEffect(() => { tratadores.current = { finalizar, erroVideo }; }, [finalizar, erroVideo]);

  const pular = useCallback(async () => {
    const alvo = estadoRef.current?.atual ?? estadoRef.current?.fila[0];
    if (!alvo) return;
    if (faseRef.current === 'contagem' || faseRef.current === 'cantando') abortar();
    await acao({ acao: 'pular', id: alvo.id });
  }, [abortar, acao]);

  const alternarPausa = useCallback(() => {
    const p = playerRef.current;
    if (!p || faseRef.current !== 'cantando') return;
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
              if (!gravandoRef.current) { iniciarGravacao(); gravandoRef.current = true; } else pausarGravacao(false);
            } else if (e.data === PAUSED || e.data === BUFFERING) { setTocando(false); pausarGravacao(true); }
            else if (e.data === ENDED) tratadores.current.finalizar();
          },
          onError: () => tratadores.current.erroVideo(),
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
  }, [admin, iniciarGravacao, pausarGravacao]);

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
    else { void pitch.ligar(); gravarLS(LS_LIGADO, '1'); }
  };
  const escolherDispositivo = (id: string) => { setDeviceId(id || null); gravarLS(LS_DISPOSITIVO, id || null); };
  const mudarVolume = (v: number) => { setVolumeVoz(v); gravarLS(LS_VOLUME, String(v)); };

  // ---------- desenho ----------
  const atual = estado?.atual ?? null;
  const proximo = estado?.fila[0] ?? null;
  const emPalco = fase === 'contagem' || fase === 'cantando';
  const item = emCurso ?? atual;

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

  return <div className={styles.root + (admin ? '' : ` ${styles.semFaixa}`)}>
    <div className={styles.topo}><span className={styles.marca}>Natal em Família · Karaokê</span></div>

    {admin ? <div ref={caixaRef} className={`${styles.videoCaixa} ${fase === 'cantando' ? '' : styles.videoOculto}`} /> : null}

    {fase === 'cantando' && item ? <aside className={styles.lateral}>
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

    {fase === 'nota' && resultado ? <NotaCena item={resultado.item} r={resultado.r} /> : null}
    {fase === 'ocioso' || fase === 'pulando' ? cartazOcioso() : null}

    {aviso ? <p className={styles.aviso} role="status">{aviso}</p> : null}

    {admin ? <>
      <div className={styles.faixa}>
        {fase === 'ocioso' && (proximo || atual) ? <button type="button" className={`${styles.botao} ${styles.botaoPrincipal}`} onClick={() => void iniciar(atual ? undefined : proximo?.id)}><Play size={18} aria-hidden="true" />Começar</button> : null}
        {fase === 'cantando' ? <button type="button" className={`${styles.botao} ${styles.botaoPrincipal}`} onClick={() => finalizar(true)}><Star size={18} aria-hidden="true" />Encerrar e ver a nota</button> : null}
        {fase === 'cantando' ? <button type="button" className={styles.botao} onClick={alternarPausa}>{tocando ? <><Pause size={18} aria-hidden="true" />Pausar</> : <><Play size={18} aria-hidden="true" />Continuar</>}</button> : null}
        <button type="button" className={styles.botao} disabled={!atual && !proximo} onClick={() => void pular()}><SkipForward size={18} aria-hidden="true" />Pular</button>
        <button type="button" className={`${styles.botao} ${pitch.status === 'ativo' ? styles.botaoLigado : ''}`} onClick={() => setConfig((c) => !c)} aria-expanded={config}>{pitch.status === 'ativo' ? <Mic size={18} aria-hidden="true" /> : <MicOff size={18} aria-hidden="true" />}Microfone</button>
        <button type="button" className={`${styles.botao} ${vozNaTv ? styles.botaoLigado : ''}`} onClick={() => { if (!vozNaTv) avisar(AVISO_MICROFONIA); setVozNaTv((v) => !v); if (pitch.status !== 'ativo') void pitch.ligar(); }} aria-pressed={vozNaTv}>{vozNaTv ? <Volume2 size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}Voz na TV</button>
        <button type="button" className={`${styles.botao} ${auto ? styles.botaoLigado : ''}`} onClick={() => setAuto((a) => !a)} aria-pressed={auto}><Repeat size={18} aria-hidden="true" />Passar sozinho</button>
      </div>
      {config ? <div className={styles.config} role="dialog" aria-label="Configurar microfone">
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
        <label>Volume da voz na TV
          <input type="range" min={0.1} max={1} step={0.05} value={volumeVoz} onChange={(e) => mudarVolume(Number(e.target.value))} />
        </label>
        <p className={styles.aviso2}>Com a Voz na TV ligada o som das caixas pode voltar para o microfone e apitar (microfonia). {AVISO_MICROFONIA}. Comece com o volume baixo.</p>
      </div> : null}
    </> : <p className={styles.aviso}>Entre com a conta de quem organiza para controlar o karaokê.</p>}
  </div>;
}
