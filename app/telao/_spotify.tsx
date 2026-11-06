'use client';
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Music2, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { api } from '@/app/ui/client';
import styles from './spotify.module.css';

// Spotify tocando NO telão: o notebook vira um aparelho Spotify Connect ("Telão Natal em Família") via Web Playback SDK.

// ---------- tipos mínimos do Web Playback SDK ----------
type TrilhaSdk = { uri: string; name: string; artists: { name: string }[]; album: { images: { url: string }[] } };
type EstadoSdk = { paused: boolean; position: number; duration: number; track_window: { current_track: TrilhaSdk } };
type ErroSdk = { message: string };
interface JogadorSpotify {
  connect(): Promise<boolean>;
  disconnect(): void;
  activateElement(): Promise<void>;
  setVolume(volume: number): Promise<void>;
  getVolume(): Promise<number>;
  togglePlay(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  nextTrack(): Promise<void>;
  previousTrack(): Promise<void>;
  addListener(evento: 'ready' | 'not_ready', cb: (d: { device_id: string }) => void): boolean;
  addListener(evento: 'player_state_changed', cb: (estado: EstadoSdk | null) => void): boolean;
  addListener(evento: 'autoplay_failed', cb: () => void): boolean;
  addListener(evento: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error', cb: (e: ErroSdk) => void): boolean;
}
declare global {
  interface Window {
    Spotify?: { Player: new (opcoes: { name: string; getOAuthToken: (cb: (token: string) => void) => void; volume?: number }) => JogadorSpotify };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

const NOME_APARELHO = 'Telão Natal em Família';
let sdkPronto: Promise<void> | null = null;

/** Carrega o script do SDK uma única vez. */
function carregarSdk(): Promise<void> {
  if (window.Spotify) return Promise.resolve();
  if (!sdkPronto) {
    sdkPronto = new Promise<void>((resolve, reject) => {
      window.onSpotifyWebPlaybackSDKReady = () => resolve();
      const s = document.createElement('script');
      s.src = 'https://sdk.scdn.co/spotify-player.js';
      s.async = true;
      s.onerror = () => { sdkPronto = null; s.remove(); reject(new Error('Não foi possível carregar o player do Spotify.')); };
      document.body.appendChild(s);
    });
  }
  return sdkPronto;
}

export type FaixaTelao = { nome: string; artista: string; capa: string | null; duracao_ms: number; posicao_ms: number };
export type AcaoPlayerTelao = 'alternar' | 'pausar' | 'continuar' | 'proxima' | 'anterior' | { acao: 'volume'; valor: number };
export type EstadoSpotifyTelao = { pronto: boolean; tocando: boolean; faixa: FaixaTelao | null; volume: number };
type RespostaToken = { access_token?: string; expira_em?: number; precisa_reconectar?: boolean };

export function useSpotifyTelao({ ativo }: { ativo: boolean }) {
  const [pronto, setPronto] = useState(false);
  const [precisaClique, setPrecisaClique] = useState(false);
  const [precisaReconectar, setPrecisaReconectar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tocando, setTocando] = useState(false);
  const [faixa, setFaixa] = useState<FaixaTelao | null>(null);
  const [volume, setVolume] = useState(60);
  const jogador = useRef<JogadorSpotify | null>(null);
  const conectado = useRef(false);
  const foto = useRef<{ pos: number; em: number; pausado: boolean; duracao: number } | null>(null);

  useEffect(() => {
    if (!ativo) return;
    let morto = false;
    const cache = { token: '', expira: 0 };
    let relogio: ReturnType<typeof setInterval> | undefined;

    async function pegarToken(): Promise<string> {
      if (cache.token && cache.expira - Date.now() > 90_000) return cache.token;
      try {
        const r = await api<RespostaToken>('/api/spotify/player?parte=token');
        if (r.precisa_reconectar || !r.access_token) { if (!morto) setPrecisaReconectar(true); return ''; }
        cache.token = r.access_token;
        cache.expira = r.expira_em || Date.now() + 50 * 60_000;
        return cache.token;
      } catch (e) {
        if (!morto) setErro((e as Error).message);
        return '';
      }
    }

    carregarSdk().then(() => {
      if (morto || !window.Spotify) return;
      const p = new window.Spotify.Player({
        name: NOME_APARELHO, volume: 0.6,
        getOAuthToken: (cb) => { void pegarToken().then((t) => { if (t) cb(t); }); },
      });
      jogador.current = p;
      p.addListener('ready', ({ device_id }) => {
        // Registra o aparelho e passa a reprodução para ele (o servidor faz as duas coisas).
        api('/api/spotify/player', { method: 'POST', json: { acao: 'registrar', device_id } })
          .catch(() => undefined)
          .finally(() => { if (!morto) setPronto(true); });
      });
      p.addListener('not_ready', () => { if (!morto) setPronto(false); });
      p.addListener('player_state_changed', (st) => {
        if (morto) return;
        if (!st) { foto.current = null; setTocando(false); setFaixa(null); return; }
        const t = st.track_window.current_track;
        foto.current = { pos: st.position, em: Date.now(), pausado: st.paused, duracao: st.duration };
        setTocando(!st.paused);
        setFaixa({ nome: t.name, artista: t.artists.map((a) => a.name).join(', '), capa: t.album.images[0]?.url || null,
          duracao_ms: st.duration, posicao_ms: st.position });
      });
      p.addListener('autoplay_failed', () => { if (!morto) setPrecisaClique(true); });
      p.addListener('authentication_error', () => { if (!morto) setPrecisaReconectar(true); });
      p.addListener('account_error', () => { if (!morto) setErro('A conta Spotify de quem organiza precisa ser Premium para tocar no telão.'); });
      p.addListener('initialization_error', (e) => { if (!morto) setErro(e.message); });
      p.addListener('playback_error', (e) => { if (!morto) setErro(e.message); });
      // O Chrome só libera áudio depois de um gesto. Se a página já teve toque ou tecla, conecta direto.
      if (navigator.userActivation?.hasBeenActive) { conectado.current = true; void p.connect(); }
      else setPrecisaClique(true);
      // O volume também muda pelo celular (Web API): relê do SDK de vez em quando.
      relogio = setInterval(() => { void p.getVolume().then((v) => { if (!morto && typeof v === 'number') setVolume(Math.round(v * 100)); }).catch(() => undefined); }, 5000);
    }).catch((e: Error) => { if (!morto) setErro(e.message); });

    return () => {
      morto = true;
      if (relogio) clearInterval(relogio);
      jogador.current?.disconnect();
      jogador.current = null;
      conectado.current = false;
      foto.current = null;
    };
  }, [ativo]);

  // Posição que anda sozinha entre um evento do SDK e o próximo (sem desvio: parte da foto do último evento).
  const temFaixa = faixa !== null;
  useEffect(() => {
    if (!ativo || !tocando || !temFaixa) return;
    const t = setInterval(() => {
      const f = foto.current;
      if (!f || f.pausado) return;
      const pos = Math.min(f.duracao, f.pos + (Date.now() - f.em));
      setFaixa((atual) => (atual ? { ...atual, posicao_ms: pos } : atual));
    }, 400);
    return () => clearInterval(t);
  }, [ativo, tocando, temFaixa]);

  /** Chamar dentro de um clique: libera o áudio do navegador e conecta o aparelho. */
  const ativar = useCallback(async () => {
    const p = jogador.current;
    if (!p) return;
    try { await p.activateElement(); } catch { /* segue mesmo assim */ }
    setPrecisaClique(false);
    if (!conectado.current) { conectado.current = true; await p.connect().catch(() => undefined); }
  }, []);

  const controlar = useCallback((acao: AcaoPlayerTelao) => {
    const p = jogador.current;
    if (!p) return;
    let r: Promise<void>;
    if (typeof acao === 'object') {
      const v = Math.min(100, Math.max(0, Math.round(acao.valor)));
      setVolume(v);
      r = p.setVolume(v / 100);
    } else if (acao === 'alternar') r = p.togglePlay();
    else if (acao === 'pausar') r = p.pause();
    else if (acao === 'continuar') r = p.resume();
    else if (acao === 'proxima') r = p.nextTrack();
    else r = p.previousTrack();
    r.catch(() => undefined);
  }, []);

  return {
    pronto: ativo && pronto,
    precisaClique: ativo && precisaClique,
    precisaReconectar: ativo && precisaReconectar,
    erro: ativo ? erro : null,
    tocando: ativo && tocando,
    faixa: ativo ? faixa : null,
    volume,
    ativar,
    controlar,
  };
}

/** Botão grande, uma vez só: o gesto que o Chrome exige para liberar o áudio. */
export function AtivarSomTelao({ onAtivar }: { onAtivar: () => void }) {
  return <div className={styles.ativar}>
    <button type="button" className={styles.ativarBtn} onClick={onAtivar}><Music2 aria-hidden="true" /> Ligar a música no telão</button>
    <p className={styles.ativarDica}>Um toque libera o som do Spotify neste aparelho.</p>
  </div>;
}

/** Aviso discreto quando a conexão com o Spotify precisa ser refeita por quem organiza. */
export function AvisoReconectarTelao() {
  return <p className={styles.aviso} role="status">Para tocar música aqui, quem organiza precisa reconectar o Spotify na página da playlist.</p>;
}

/** Barra do rodapé: capa, nome, artista e botões. Some quando o mouse fica parado (ocioso). */
export function PlayerTelao({ estado, controlar, ocioso }: {
  estado: EstadoSpotifyTelao; controlar: (acao: AcaoPlayerTelao) => void; ocioso: boolean;
}) {
  const { faixa, tocando, volume } = estado;
  if (!estado.pronto || !faixa) return null;
  const frac = faixa.duracao_ms > 0 ? Math.min(1, Math.max(0, faixa.posicao_ms / faixa.duracao_ms)) : 0;
  return <div className={`${styles.player} ${ocioso ? styles.playerOculto : ''}`} aria-hidden={ocioso}>
    {faixa.capa ? <img src={faixa.capa} alt="" className={styles.pCapa} /> : <span className={styles.pCapa}><Music2 size="4vmin" /></span>}
    <div className={styles.pTexto}>
      <p className={styles.pNome}>{faixa.nome}</p>
      <p className={styles.pArtista}>{faixa.artista}</p>
    </div>
    <div className={styles.pBotoes}>
      <button type="button" className={styles.pBtn} onClick={() => controlar('anterior')} aria-label="Música anterior" tabIndex={ocioso ? -1 : 0}><SkipBack /></button>
      <button type="button" className={`${styles.pBtn} ${styles.pBtnMain}`} onClick={() => controlar('alternar')} aria-label={tocando ? 'Pausar' : 'Tocar'} tabIndex={ocioso ? -1 : 0}>{tocando ? <Pause /> : <Play />}</button>
      <button type="button" className={styles.pBtn} onClick={() => controlar('proxima')} aria-label="Próxima música" tabIndex={ocioso ? -1 : 0}><SkipForward /></button>
    </div>
    <label className={styles.pVolume}>
      {volume === 0 ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
      <input type="range" min={0} max={100} value={volume} aria-label="Volume" tabIndex={ocioso ? -1 : 0}
        onChange={(ev) => controlar({ acao: 'volume', valor: Number(ev.target.value) })} />
    </label>
    <div className={styles.pProgresso} aria-hidden="true"><div className={styles.pProgressoPreench} style={{ transform: `scaleX(${frac})` }} /></div>
  </div>;
}
