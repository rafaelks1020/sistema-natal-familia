'use client';

// Câmera do karaokê estilo Kinect: fundo com a câmera espelhada, filtros de Natal sobre os rostos,
// detecção de quem está cantando e faíscas douradas. Veja camera.md para ligar no telão.

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import styles from './_camera.module.css';

// ---------- constantes ----------

/** Precisa ser IGUAL à versão instalada de @mediapipe/tasks-vision (package.json), senão o WASM não casa com o JS. */
const VERSAO_MEDIAPIPE = '1.2.2';
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSAO_MEDIAPIPE}/wasm`;
const MODELO_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const INTERVALO_DETECCAO_MS = 55; // ~18 detecções por segundo
const LIMIAR_VOLUME = 0.05; // abaixo disso ninguém está cantando
const SILENCIO_SOLTA_MS = 2500; // sem volume por tanto tempo, ninguém é o cantor
const SUAVIZA_JAW = 0.25; // peso da média móvel do jawOpen
const MAX_FAISCAS = 150;
const FAISCAS_POR_ACERTO = 14;
const LARGURA_MAX_CANVAS = 1920;
const LS_EFEITOS = 'karaoke.camera.efeitos';

// Índices da malha facial do MediaPipe (478 pontos).
const P_TESTA = 10;
const P_QUEIXO = 152;
const P_NARIZ_PONTA = 1;
const P_NARIZ_BASE = 2;
const P_OLHO_A = [33, 133]; // olho que aparece à esquerda do vídeo (cantos externo e interno)
const P_OLHO_B = [263, 362];
const P_TEMPORA_A = 127;
const P_TEMPORA_B = 356;

// ---------- tipos ----------

/** Ponto normalizado (0..1) no quadro do vídeo, SEM espelhar. */
export interface Ponto { x: number; y: number }

export interface Rosto {
  caixa: { x: number; y: number; w: number; h: number };
  testa: Ponto;
  olhoE: Ponto; // olho que está à esquerda do vídeo (centro)
  olhoD: Ponto;
  nariz: Ponto; // ponta do nariz
  narizBase: Ponto; // base do nariz (acima da boca)
  queixo: Ponto;
  temporaE: Ponto;
  temporaD: Ponto;
  /** Ângulo (rad) da linha entre os olhos no quadro do vídeo; 0 = cabeça reta. */
  rolagem: number;
  /** Distância entre os olhos, normalizada pela largura do vídeo. */
  escala: number;
  /** 0..1, abertura da boca (blendshape jawOpen). */
  jawOpen: number;
}

export interface Efeitos { gorro: boolean; barba: boolean; chifres: boolean; oculos: boolean }
export type Filtro = keyof Efeitos;

export const EFEITOS_PADRAO: Efeitos = { gorro: true, barba: false, chifres: false, oculos: false };

type Ou<T> = T | RefObject<T>;

export interface OpcoesCamera {
  ligada: boolean;
  deviceId?: string;
  /** Volume atual do microfone (0..1). Número (re-renderiza a cada mudança) ou função lida a cada detecção (recomendado: () => vivo.current.rms normalizado). */
  volume?: number | (() => number);
}

export interface DispositivoCamera { deviceId: string; label: string }

export interface RetornoCamera {
  /** Ref do <video> (criado pelo hook, fora do DOM). Passe direto para <CameraFundo video={...}>. */
  video: RefObject<HTMLVideoElement | null>;
  /** Câmera aberta e tocando. */
  pronta: boolean;
  /** Modelo de rostos carregado (a detecção só começa depois disso). */
  modeloPronto: boolean;
  erro: string | null;
  /** Estado de baixa frequência (muda quando o número de rostos ou o cantor muda). Para desenhar use rostosRef. */
  rostos: Rosto[];
  /** Índice do cantor em `rostos` (ordem da esquerda para a direita NA TELA), ou -1. */
  cantandoIdx: number;
  /** Atualizados a cada detecção (~18/s) sem re-render. Passe estes para <CameraFundo>. */
  rostosRef: RefObject<Rosto[]>;
  cantandoRef: RefObject<number>;
  ligar: () => void;
  desligar: () => void;
  dispositivos: DispositivoCamera[];
}

// ---------- utilidades ----------

function ehRef<T>(v: Ou<T>): v is RefObject<T> {
  return typeof v === 'object' && v !== null && 'current' in (v as object) && !Array.isArray(v);
}
function ler<T>(v: Ou<T>): T { return ehRef(v) ? v.current : v; }

function mensagemErro(e: unknown): string {
  const nome = e instanceof Error ? e.name : '';
  if (nome === 'NotAllowedError' || nome === 'SecurityError') return 'Permissão da câmera negada. Libere a câmera no navegador.';
  if (nome === 'NotFoundError' || nome === 'OverconstrainedError') return 'Nenhuma câmera encontrada.';
  if (nome === 'NotReadableError' || nome === 'AbortError') return 'A câmera está em uso por outro programa.';
  return e instanceof Error && e.message ? e.message : 'Não consegui abrir a câmera.';
}

const dist = (a: Ponto, b: Ponto) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------- hook ----------

function extrairRostos(r: FaceLandmarkerResult, larg: number, alt: number): Rosto[] {
  const rostos: Rosto[] = [];
  r.faceLandmarks.forEach((pts, i) => {
    if (pts.length < 400) return;
    const p = (k: number): Ponto => ({ x: pts[k].x, y: pts[k].y });
    const meio = (ks: number[]): Ponto => ({ x: ks.reduce((s, k) => s + pts[k].x, 0) / ks.length, y: ks.reduce((s, k) => s + pts[k].y, 0) / ks.length });
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    for (const q of pts) { if (q.x < minX) minX = q.x; if (q.x > maxX) maxX = q.x; if (q.y < minY) minY = q.y; if (q.y > maxY) maxY = q.y; }
    const a = meio(P_OLHO_A), b = meio(P_OLHO_B);
    const [olhoE, olhoD] = a.x <= b.x ? [a, b] : [b, a];
    const jaw = r.faceBlendshapes?.[i]?.categories.find((c) => c.categoryName === 'jawOpen')?.score ?? 0;
    const temA = p(P_TEMPORA_A), temB = p(P_TEMPORA_B);
    const [temporaE, temporaD] = temA.x <= temB.x ? [temA, temB] : [temB, temA];
    rostos.push({
      caixa: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
      testa: p(P_TESTA), olhoE, olhoD, nariz: p(P_NARIZ_PONTA), narizBase: p(P_NARIZ_BASE), queixo: p(P_QUEIXO), temporaE, temporaD,
      rolagem: Math.atan2((olhoD.y - olhoE.y) * alt, (olhoD.x - olhoE.x) * larg),
      escala: Math.hypot(olhoD.x - olhoE.x, (olhoD.y - olhoE.y) * (alt / larg)),
      jawOpen: jaw,
    });
  });
  // Ordem estável: esquerda para a direita NA TELA (a tela é espelhada, então x maior do vídeo vem primeiro).
  rostos.sort((m, n) => (n.caixa.x + n.caixa.w / 2) - (m.caixa.x + m.caixa.w / 2));
  return rostos;
}

export function useCameraKaraoke({ ligada, deviceId, volume }: OpcoesCamera): RetornoCamera {
  const [manual, setManual] = useState<boolean | undefined>(undefined);
  const [anterior, setAnterior] = useState(ligada);
  if (anterior !== ligada) { setAnterior(ligada); setManual(undefined); }
  const ativo = manual ?? ligada;

  const [pronta, setPronta] = useState(false);
  const [modeloPronto, setModeloPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [rostos, setRostos] = useState<Rosto[]>([]);
  const [cantandoIdx, setCantandoIdx] = useState(-1);
  const [dispositivos, setDispositivos] = useState<DispositivoCamera[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rostosRef = useRef<Rosto[]>([]);
  const cantandoRef = useRef(-1);
  const volumeRef = useRef(volume);
  useEffect(() => { volumeRef.current = volume; });

  // 1) abre a câmera
  useEffect(() => {
    if (!ativo) return;
    let cancelado = false;
    let stream: MediaStream | null = null;
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.autoplay = true;

    const abrir = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador não abre a câmera (precisa de HTTPS).');
        const base: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 } };
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: deviceId ? { ...base, deviceId: { exact: deviceId } } : { ...base, facingMode: 'user' }, audio: false });
        } catch (e) {
          // Câmera escolhida sumiu: tenta a padrão.
          if (deviceId && e instanceof Error && e.name === 'OverconstrainedError') stream = await navigator.mediaDevices.getUserMedia({ video: base, audio: false });
          else throw e;
        }
        if (cancelado) { stream.getTracks().forEach((t) => t.stop()); return; }
        v.srcObject = stream;
        await v.play();
        if (cancelado) return;
        videoRef.current = v;
        setErro(null);
        setPronta(true);
        const lista = await navigator.mediaDevices.enumerateDevices();
        if (!cancelado) setDispositivos(lista.filter((d) => d.kind === 'videoinput').map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Câmera ${i + 1}` })));
      } catch (e) {
        if (!cancelado) setErro(mensagemErro(e));
      }
    };
    void abrir();

    return () => {
      cancelado = true;
      stream?.getTracks().forEach((t) => t.stop());
      v.srcObject = null;
      if (videoRef.current === v) videoRef.current = null;
      setPronta(false);
    };
  }, [ativo, deviceId]);

  // 2) detecção de rostos (carrega o MediaPipe só quando a câmera liga)
  useEffect(() => {
    if (!ativo || !pronta) return;
    let cancelado = false;
    let raf = 0;
    let landmarker: FaceLandmarker | null = null;

    let ultimoMs = 0;
    let ultimoTempoVideo = -1;
    let energia: number[] = [];
    let atual = -1;
    let ultimoSomMs = 0;
    let ultimoEstadoMs = 0;

    const publicar = (lista: Rosto[], idx: number, agora: number) => {
      const mudou = lista.length !== rostosRef.current.length || idx !== cantandoRef.current;
      rostosRef.current = lista;
      cantandoRef.current = idx;
      // Estado do React só quando algo relevante muda (ou a cada 1 s), para não re-renderizar o telão 18x por segundo.
      if (mudou || agora - ultimoEstadoMs > 1000) { ultimoEstadoMs = agora; setRostos(lista); setCantandoIdx(idx); }
    };

    const quemCanta = (lista: Rosto[], agora: number): number => {
      const n = lista.length;
      if (n === 0) { energia = []; return -1; }
      if (n === 1) { energia = [lista[0].jawOpen]; return 0; }
      if (energia.length !== n) { energia = lista.map((r) => r.jawOpen); atual = -1; }
      const lerVol = volumeRef.current;
      const vol = typeof lerVol === 'function' ? lerVol() : (lerVol ?? 0);
      if (vol > LIMIAR_VOLUME) {
        ultimoSomMs = agora;
        lista.forEach((r, i) => { energia[i] += (r.jawOpen - energia[i]) * SUAVIZA_JAW; });
        let melhor = 0;
        energia.forEach((e, i) => { if (e > energia[melhor]) melhor = i; });
        if (atual < 0 || atual >= n || (melhor !== atual && energia[melhor] > energia[atual] * 1.2 + 0.01)) atual = melhor;
      } else {
        energia = energia.map((e) => e * 0.9);
        if (agora - ultimoSomMs > SILENCIO_SOLTA_MS) atual = -1;
      }
      return atual;
    };

    const passo = () => {
      if (cancelado || !landmarker) return;
      raf = requestAnimationFrame(passo);
      const v = videoRef.current;
      const agora = performance.now();
      if (!v || v.readyState < 2 || v.videoWidth === 0) return;
      if (agora - ultimoMs < INTERVALO_DETECCAO_MS || v.currentTime === ultimoTempoVideo) return;
      ultimoMs = agora;
      ultimoTempoVideo = v.currentTime;
      try {
        const lista = extrairRostos(landmarker.detectForVideo(v, agora), v.videoWidth, v.videoHeight);
        publicar(lista, quemCanta(lista, agora), agora);
      } catch {
        // quadro ruim: ignora e tenta no próximo
      }
    };

    void (async () => {
      const { FaceLandmarker: FL, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const arquivos = await FilesetResolver.forVisionTasks(WASM_URL);
      const opcoes = (delegate: 'GPU' | 'CPU') => ({
        baseOptions: { modelAssetPath: MODELO_URL, delegate },
        runningMode: 'VIDEO' as const,
        numFaces: 2,
        outputFaceBlendshapes: true,
      });
      let lm: FaceLandmarker;
      try { lm = await FL.createFromOptions(arquivos, opcoes('GPU')); }
      catch { lm = await FL.createFromOptions(arquivos, opcoes('CPU')); }
      if (cancelado) { lm.close(); return; }
      landmarker = lm;
      setModeloPronto(true);
      raf = requestAnimationFrame(passo);
    })().catch((e) => { if (!cancelado) setErro(e instanceof Error ? `Não consegui carregar a detecção de rostos: ${e.message}` : 'Não consegui carregar a detecção de rostos.'); });

    return () => {
      cancelado = true;
      cancelAnimationFrame(raf);
      landmarker?.close();
      rostosRef.current = [];
      cantandoRef.current = -1;
      setModeloPronto(false);
      setRostos([]);
      setCantandoIdx(-1);
    };
  }, [ativo, pronta]);

  const ligar = useCallback(() => { setErro(null); setManual(true); }, []);
  const desligar = useCallback(() => setManual(false), []);

  return { video: videoRef, pronta, modeloPronto, erro, rostos, cantandoIdx, rostosRef, cantandoRef, ligar, desligar, dispositivos };
}

// ---------- imagens dos filtros ----------

const URL_FILTRO: Record<Filtro, string> = {
  gorro: '/karaoke/filtros/gorro.png',
  barba: '/karaoke/filtros/barba.png',
  chifres: '/karaoke/filtros/chifres.png',
  oculos: '/karaoke/filtros/oculos.png',
};

const cacheImagens = new Map<string, { img: HTMLImageElement; ok: boolean }>();

/** Devolve a imagem só quando carregou; se falhou (ou ainda não existe) devolve null e o filtro some sem quebrar. */
function imagemFiltro(url: string): HTMLImageElement | null {
  let e = cacheImagens.get(url);
  if (!e) {
    const img = new Image();
    e = { img, ok: false };
    const entrada = e;
    img.onload = () => { entrada.ok = img.naturalWidth > 0; };
    img.onerror = () => { entrada.ok = false; };
    img.src = url;
    cacheImagens.set(url, e);
  }
  return e.ok ? e.img : null;
}

// ---------- desenho ----------

interface Faisca { x: number; y: number; vx: number; vy: number; vida: number; max: number; tam: number }

interface Quadro { cw: number; ch: number; dx: number; dy: number; dw: number; dh: number }

/** Ponto do vídeo -> pixel do canvas, com o espelho e o "cover" aplicados. */
function mapear(q: Quadro, p: Ponto): Ponto { return { x: q.cw - (q.dx + p.x * q.dw), y: q.dy + p.y * q.dh }; }

function desenharFiltros(ctx: CanvasRenderingContext2D, q: Quadro, r: Rosto, efeitos: Efeitos) {
  const olhoE = mapear(q, r.olhoE), olhoD = mapear(q, r.olhoD);
  const [a, b] = olhoE.x <= olhoD.x ? [olhoE, olhoD] : [olhoD, olhoE];
  const rolagem = Math.atan2(b.y - a.y, b.x - a.x);
  const entreOlhos = dist(a, b);
  const temporas = dist(mapear(q, r.temporaE), mapear(q, r.temporaD));
  const testa = mapear(q, r.testa);
  const queixo = mapear(q, r.queixo);
  const narizBase = mapear(q, r.narizBase);

  const sobre = (img: HTMLImageElement, ancora: Ponto, largura: number, altura: number, dxRel: number, dyRel: number) => {
    ctx.save();
    ctx.translate(ancora.x, ancora.y);
    ctx.rotate(rolagem);
    ctx.drawImage(img, dxRel, dyRel, largura, altura);
    ctx.restore();
  };
  const proporcao = (img: HTMLImageElement) => img.naturalHeight / img.naturalWidth;

  if (efeitos.barba) {
    const img = imagemFiltro(URL_FILTRO.barba);
    if (img) {
      const h = dist(narizBase, queixo) * 1.35;
      const w = temporas * 1.45;
      sobre(img, narizBase, w, h, -w / 2, -h * 0.04);
    }
  }
  if (efeitos.oculos) {
    const img = imagemFiltro(URL_FILTRO.oculos);
    if (img) {
      const w = entreOlhos * 2.4, h = w * proporcao(img);
      sobre(img, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, w, h, -w / 2, -h / 2);
    }
  }
  if (efeitos.chifres) {
    const img = imagemFiltro(URL_FILTRO.chifres);
    if (img) {
      const w = temporas * 1.6, h = w * proporcao(img);
      sobre(img, testa, w, h, -w / 2, -h * 0.95);
    }
  }
  if (efeitos.gorro) {
    const img = imagemFiltro(URL_FILTRO.gorro);
    if (img) {
      const w = temporas * 1.6, h = w * proporcao(img);
      sobre(img, testa, w, h, -w / 2, -h * 0.88);
    }
  }
}

function desenharCantor(ctx: CanvasRenderingContext2D, q: Quadro, r: Rosto, nome: string | undefined, tempoMs: number) {
  const testa = mapear(q, r.testa), queixo = mapear(q, r.queixo);
  const temporas = dist(mapear(q, r.temporaE), mapear(q, r.temporaD));
  const olhoE = mapear(q, r.olhoE), olhoD = mapear(q, r.olhoD);
  const [a, b] = olhoE.x <= olhoD.x ? [olhoE, olhoD] : [olhoD, olhoE];
  const rolagem = Math.atan2(b.y - a.y, b.x - a.x);
  const altura = dist(testa, queixo);
  const centro = { x: (testa.x + queixo.x) / 2, y: (testa.y + queixo.y) / 2 };
  const pulso = 0.5 + 0.5 * Math.sin(tempoMs / 260);
  const esc = Math.max(0.5, altura / 220);

  ctx.save();
  ctx.translate(centro.x, centro.y);
  ctx.rotate(rolagem);
  ctx.shadowColor = 'rgba(255, 205, 90, 0.9)';
  ctx.shadowBlur = (26 + 14 * pulso) * esc;
  ctx.strokeStyle = `rgba(255, 214, 120, ${0.55 + 0.3 * pulso})`;
  ctx.lineWidth = 4 * esc;
  ctx.beginPath();
  ctx.ellipse(0, 0, temporas * 0.64, altura * 0.68, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  if (nome) {
    const tam = Math.max(18, altura * 0.17);
    ctx.save();
    ctx.font = `700 ${tam}px Manrope, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const largura = ctx.measureText(nome).width + tam * 1.2;
    const alt = tam * 1.7;
    const x = queixo.x - largura / 2;
    const y = queixo.y + altura * 0.2;
    ctx.fillStyle = 'rgba(23, 27, 24, 0.82)';
    ctx.strokeStyle = 'rgba(255, 214, 120, 0.95)';
    ctx.lineWidth = Math.max(2, tam * 0.1);
    ctx.beginPath();
    ctx.roundRect(x, y, largura, alt, alt / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff6dd';
    ctx.fillText(nome, queixo.x, y + alt / 2 + 1);
    ctx.restore();
  }
}

function desenharFaiscas(ctx: CanvasRenderingContext2D, lista: Faisca[], dt: number, esc: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = lista.length - 1; i >= 0; i--) {
    const f = lista[i];
    f.vida -= dt;
    if (f.vida <= 0) { lista.splice(i, 1); continue; }
    f.vy += 260 * esc * dt; // gravidade leve
    f.vx *= 1 - 0.8 * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    const t = f.vida / f.max;
    const r = f.tam * (0.4 + 0.6 * t) * esc;
    ctx.fillStyle = `rgba(255, 210, 100, ${0.22 * t})`;
    ctx.beginPath(); ctx.arc(f.x, f.y, r * 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255, 244, 200, ${0.4 + 0.6 * t})`;
    ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function emitirFaiscas(lista: Faisca[], origem: Ponto, quantidade: number, esc: number) {
  for (let i = 0; i < quantidade && lista.length < MAX_FAISCAS; i++) {
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
    const vel = (200 + Math.random() * 520) * esc;
    const max = 0.8 + Math.random() * 0.9;
    lista.push({
      x: origem.x + (Math.random() - 0.5) * 90 * esc, y: origem.y + (Math.random() - 0.5) * 90 * esc,
      vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel, vida: max, max, tam: 3 + Math.random() * 4,
    });
  }
}

// ---------- componente do fundo ----------

export interface PropsCameraFundo {
  video: Ou<HTMLVideoElement | null>;
  /** Passe `rostosRef` do hook (atualiza sem re-render) ou o array `rostos`. */
  rostos: Ou<Rosto[]>;
  /** Passe `cantandoRef` do hook ou o número `cantandoIdx`. */
  cantandoIdx: Ou<number>;
  /** nomes[i] é o nome de quem está no rosto i (da esquerda para a direita na tela). */
  nomes?: string[];
  efeitos: Efeitos;
  /** Contador de acertos recentes: cada aumento solta faíscas do rosto do cantor. */
  faiscas?: number;
  /** 0..1, quanto escurecer o vídeo (padrão 0.35). */
  escurecer?: number;
  zIndex?: number;
  /** Para tirarFoto(canvasRef.current). */
  canvasRef?: RefObject<HTMLCanvasElement | null>;
}

export function CameraFundo({ video, rostos, cantandoIdx, nomes, efeitos, faiscas = 0, escurecer = 0.35, zIndex = 0, canvasRef }: PropsCameraFundo) {
  const interno = useRef<HTMLCanvasElement | null>(null);
  const alvo = canvasRef ?? interno;
  const props = useRef({ video, rostos, cantandoIdx, nomes, efeitos, escurecer });
  useEffect(() => { props.current = { video, rostos, cantandoIdx, nomes, efeitos, escurecer }; });

  const pendentes = useRef(0);
  const anteriorFaiscas = useRef(faiscas);
  useEffect(() => {
    const delta = faiscas - anteriorFaiscas.current;
    anteriorFaiscas.current = faiscas;
    if (delta > 0) pendentes.current += Math.min(delta, 5);
  }, [faiscas]);

  useEffect(() => {
    const canvas = alvo.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let raf = 0;
    let ultimo = performance.now();
    const particulas: Faisca[] = [];

    const quadro = (): void => {
      raf = requestAnimationFrame(quadro);
      const agora = performance.now();
      const dt = Math.min(0.05, (agora - ultimo) / 1000);
      ultimo = agora;

      // resolução interna acompanha o tamanho na tela (limitada para não pesar)
      const escDpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const cw = Math.min(LARGURA_MAX_CANVAS, Math.max(2, Math.round(canvas.clientWidth * escDpr)));
      const ch = Math.max(2, Math.round(cw * (canvas.clientHeight / Math.max(1, canvas.clientWidth))));
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }

      const p = props.current;
      const v = ler(p.video);
      const lista = ler(p.rostos);
      const idx = ler(p.cantandoIdx);
      const esc = ch / 1080;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cw, ch);
      if (!v || v.readyState < 2 || v.videoWidth === 0) return;

      const cobrir = Math.max(cw / v.videoWidth, ch / v.videoHeight);
      const dw = v.videoWidth * cobrir, dh = v.videoHeight * cobrir;
      const q: Quadro = { cw, ch, dx: (cw - dw) / 2, dy: (ch - dh) / 2, dw, dh };

      ctx.save();
      ctx.translate(cw, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(v, q.dx, q.dy, dw, dh);
      ctx.restore();

      // escurecimento + vinheta
      if (p.escurecer > 0) { ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.9, p.escurecer)})`; ctx.fillRect(0, 0, cw, ch); }
      const vin = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.35, cw / 2, ch / 2, Math.hypot(cw, ch) * 0.55);
      vin.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vin.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
      ctx.fillStyle = vin;
      ctx.fillRect(0, 0, cw, ch);

      lista.forEach((r, i) => {
        desenharFiltros(ctx, q, r, p.efeitos);
        if (i === idx) desenharCantor(ctx, q, r, p.nomes?.[i], agora);
      });

      if (pendentes.current > 0) {
        const cantor = lista[idx] ?? lista[0];
        const origem = cantor ? mapear(q, { x: (cantor.testa.x + cantor.queixo.x) / 2, y: (cantor.testa.y + cantor.queixo.y) / 2 }) : { x: cw / 2, y: ch / 2 };
        emitirFaiscas(particulas, origem, pendentes.current * FAISCAS_POR_ACERTO, esc);
        pendentes.current = 0;
      }
      desenharFaiscas(ctx, particulas, dt, esc);
    };
    raf = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(raf);
  }, [alvo]);

  return <canvas ref={alvo} className={styles.fundo} style={{ zIndex }} aria-hidden="true" />;
}

// ---------- escolha de filtros ----------

export function lerEfeitos(): Efeitos {
  try {
    const bruto = window.localStorage.getItem(LS_EFEITOS);
    if (!bruto) return EFEITOS_PADRAO;
    const o = JSON.parse(bruto) as Partial<Efeitos>;
    return { gorro: !!o.gorro, barba: !!o.barba, chifres: !!o.chifres, oculos: !!o.oculos };
  } catch {
    return EFEITOS_PADRAO;
  }
}

export function gravarEfeitos(e: Efeitos): void {
  try { window.localStorage.setItem(LS_EFEITOS, JSON.stringify(e)); } catch { /* sem armazenamento: segue sem salvar */ }
}

/** Efeitos com a escolha lembrada no navegador. Use só em componente que monta no cliente (depois de hidratar). */
export function useEfeitos(): [Efeitos, (e: Efeitos) => void] {
  const [efeitos, setEfeitos] = useState<Efeitos>(() => (typeof window === 'undefined' ? EFEITOS_PADRAO : lerEfeitos()));
  const mudar = useCallback((e: Efeitos) => { setEfeitos(e); gravarEfeitos(e); }, []);
  return [efeitos, mudar];
}

const CHIPS: { chave: Filtro; rotulo: string }[] = [
  { chave: 'gorro', rotulo: 'Gorro' },
  { chave: 'barba', rotulo: 'Barba' },
  { chave: 'chifres', rotulo: 'Chifres de rena' },
  { chave: 'oculos', rotulo: 'Óculos de estrela' },
];

export function EscolhaFiltros({ valor, onMudar, className }: { valor: Efeitos; onMudar: (e: Efeitos) => void; className?: string }) {
  const nenhum = !valor.gorro && !valor.barba && !valor.chifres && !valor.oculos;
  const aplicar = (e: Efeitos) => { gravarEfeitos(e); onMudar(e); };
  return (
    <div className={`${styles.chips} ${className ?? ''}`} role="group" aria-label="Filtros de Natal">
      {CHIPS.map((c) => (
        <button key={c.chave} type="button" className={`${styles.chip} ${valor[c.chave] ? styles.chipLigado : ''}`} aria-pressed={valor[c.chave]} onClick={() => aplicar({ ...valor, [c.chave]: !valor[c.chave] })}>{c.rotulo}</button>
      ))}
      <button type="button" className={`${styles.chip} ${nenhum ? styles.chipLigado : ''}`} aria-pressed={nenhum} onClick={() => aplicar({ gorro: false, barba: false, chifres: false, oculos: false })}>Nenhum</button>
    </div>
  );
}

// ---------- foto ----------

/** JPEG 0.9 da composição atual do canvas (vídeo + filtros) com o selo "Karaokê Natal em Família 2026". Não altera o canvas original. */
export function tirarFoto(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const copia = document.createElement('canvas');
  copia.width = canvas.width;
  copia.height = canvas.height;
  const ctx = copia.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(canvas, 0, 0);

  const esc = copia.height / 1080;
  // moldura dourada fina
  ctx.strokeStyle = 'rgba(255, 214, 120, 0.9)';
  ctx.lineWidth = 6 * esc;
  ctx.strokeRect(3 * esc, 3 * esc, copia.width - 6 * esc, copia.height - 6 * esc);
  // selo no canto inferior direito
  const texto = 'Karaokê Natal em Família 2026';
  const tam = 30 * esc;
  ctx.font = `700 ${tam}px Manrope, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const larg = ctx.measureText(texto).width + tam * 1.6;
  const alt = tam * 2;
  const x = copia.width - larg - 28 * esc;
  const y = copia.height - alt - 28 * esc;
  ctx.fillStyle = 'rgba(23, 27, 24, 0.85)';
  ctx.strokeStyle = 'rgba(255, 214, 120, 0.95)';
  ctx.lineWidth = 3 * esc;
  ctx.beginPath();
  ctx.roundRect(x, y, larg, alt, alt / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff6dd';
  ctx.fillText(texto, x + larg / 2, y + alt / 2 + 1);

  return new Promise((resolve) => copia.toBlob((b) => resolve(b), 'image/jpeg', 0.9));
}
