'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { erroEmSemitons, fatorDeAcerto, multiplicadorDaNota, notaEm, type NotaEstudio } from './pontuacao';
import type { PontoAltura } from './_pitch';
import type { LinhaEstudio } from './tipos';
import styles from './karaoke.module.css';

/** Janela das barras: 1 s de passado e 3 s de futuro. */
const JANELA_MS = 4000;
const PASSADO_MS = 1000;
const DT_MAX_MS = 100;
const ACERTO_ESTRELA = 0.8;
const SEGURA_LINHA_MS = 600;
const INTRO_MS = 6000;
const FEEDBACK_MS = 1700;

const limitar = (x: number, min = 0, max = 1) => (x < min ? min : x > max ? max : x);

/** Fundo da cena de estúdio: capa do álbum desfocada (se houver) e um brilho lento. */
export function FundoEstudio({ capa }: { capa: string | null }) {
  return <div className={styles.fundoLetra} aria-hidden="true">
    {capa ? <img src={capa} alt="" referrerPolicy="no-referrer" /> : null}
    <div className={styles.brilhoLetra} />
  </div>;
}

function barra(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = Math.min(h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function estrela(ctx: CanvasRenderingContext2D, cx: number, cy: number, raio: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? raio : raio * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

type Brilho = { nasc: number; x: number; y: number };

function textoDoFeedback(perfeicao: number): string | null {
  if (perfeicao >= 0.9) return 'Perfeito!';
  if (perfeicao >= 0.7) return 'Ótimo!';
  if (perfeicao >= 0.5) return 'Bom!';
  if (perfeicao >= 0.25) return 'Quase!';
  return null;
}

/**
 * Cena do modo estúdio: barras de notas rolando (estilo SingStar) com o tom do microfone por cima e, embaixo, a letra palavra a palavra.
 * lerMs: instante da música em ms já com o ajuste de sincronia. historico: altura da voz medida pelo microfone (performance.now).
 * O desenho e o preenchimento rodam em requestAnimationFrame direto no canvas e no DOM; o React só renderiza quando a linha muda.
 */
export function PalcoEstudio({ linhas, notas, lerMs, historico, latenciaRef, rodando }: {
  linhas: readonly LinhaEstudio[];
  notas: readonly NotaEstudio[];
  lerMs: () => number;
  historico: RefObject<PontoAltura[]>;
  latenciaRef: RefObject<number>;
  rodando: () => boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const letraRef = useRef<HTMLDivElement>(null);
  const [cena, setCena] = useState<{ atual: number; intro: boolean }>({ atual: 0, intro: false });
  const [feedback, setFeedback] = useState<{ id: number; texto: string } | null>(null);

  const faixa = useMemo(() => {
    if (!notas.length) return { centro: 60, span: 12 };
    let lo = Infinity;
    let hi = -Infinity;
    for (const n of notas) { lo = Math.min(lo, n.midi); hi = Math.max(hi, n.midi); }
    return { centro: (lo + hi) / 2, span: Math.max(hi - lo + 4, 12) };
  }, [notas]);

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), FEEDBACK_MS);
    return () => window.clearTimeout(t);
  }, [feedback]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let chave = '';
    let ultimoAgora = performance.now();
    let ultimoPonto = -Infinity;
    const acerto = notas.map(() => 0);
    const estrelada = notas.map(() => false);
    const brilhos: Brilho[] = [];
    // Linhas com notas: peso total, quando terminam e se já mostraram o feedback.
    const porLinha = new Map<number, { idx: number[]; max: number; fim: number; feito: boolean }>();
    notas.forEach((n, i) => {
      const l = porLinha.get(n.linha) ?? { idx: [], max: 0, fim: 0, feito: false };
      l.idx.push(i); l.max += multiplicadorDaNota(n) * n.dur_ms; l.fim = Math.max(l.fim, n.inicio_ms + n.dur_ms);
      porLinha.set(n.linha, l);
    });
    let seq = 0;

    const passo = () => {
      raf = requestAnimationFrame(passo);
      const tocando = rodando();
      const agora = tocando ? performance.now() : ultimoAgora;
      ultimoAgora = agora;
      const t = lerMs();
      const lat = latenciaRef.current ?? 0;

      // ----- letra: qual linha mostrar -----
      let atual = linhas.findIndex((l) => l.fim_ms + SEGURA_LINHA_MS > t);
      if (atual < 0) atual = linhas.length;
      const intro = atual < linhas.length && linhas[atual].inicio_ms - t > INTRO_MS;
      const nova = `${atual}|${intro ? 1 : 0}`;
      if (nova !== chave) { chave = nova; setCena({ atual, intro }); }
      const caixa = letraRef.current;
      const linha = linhas[atual];
      if (caixa && linha) {
        caixa.querySelectorAll<HTMLElement>('[data-w]').forEach((el) => {
          const p = linha.palavras[Number(el.dataset.w)];
          if (!p) return;
          const v = Math.round(limitar((t - p.inicio_ms) / Math.max(1, p.fim_ms - p.inicio_ms)) * 1000) / 1000;
          if (el.dataset.p !== String(v)) {
            el.dataset.p = String(v);
            el.style.setProperty('--p', String(v));
            el.style.setProperty('--z', String(v > 0 && v < 1 ? 1.08 - 0.08 * v : 1));
          }
        });
      }

      // ----- acertos: pontos novos do microfone -----
      const pontos = historico.current ?? [];
      if (tocando) {
        for (const p of pontos) {
          if (p.t <= ultimoPonto) continue;
          const dt = Math.min(DT_MAX_MS, ultimoPonto === -Infinity ? 33 : p.t - ultimoPonto);
          ultimoPonto = p.t;
          if (p.midi === null) continue;
          const st = t - (agora - p.t) - lat;
          const i = notaEm(notas, st);
          if (i < 0) continue;
          const f = fatorDeAcerto(erroEmSemitons(p.midi, notas[i].midi));
          acerto[i] = Math.min(notas[i].dur_ms, acerto[i] + f * dt);
          if (!estrelada[i] && acerto[i] >= ACERTO_ESTRELA * notas[i].dur_ms) {
            estrelada[i] = true;
            brilhos.push({ nasc: agora, x: 0, y: notas[i].midi });
          }
        }
      } else if (pontos.length) ultimoPonto = pontos[pontos.length - 1].t;

      // ----- feedback ao fim de cada linha -----
      if (tocando) {
        for (const [, l] of porLinha) {
          if (l.feito || t < l.fim + lat + 150) continue;
          l.feito = true;
          const ganho = l.idx.reduce((a, i) => a + multiplicadorDaNota(notas[i]) * acerto[i], 0);
          const texto = textoDoFeedback(l.max > 0 ? ganho / l.max : 0);
          if (texto) setFeedback({ id: ++seq, texto });
        }
      }

      // ----- canvas -----
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (!w || !h) return;
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      ctx.clearRect(0, 0, w, h);
      const pad = h * 0.06;
      const util = h - pad * 2;
      const yDe = (m: number) => pad + (1 - (m - (faixa.centro - faixa.span / 2)) / faixa.span) * util;
      const xDe = (ms: number) => ((ms - t + PASSADO_MS) / JANELA_MS) * w;
      const alturaBarra = limitar(util / faixa.span * 0.85, 8 * dpr, 34 * dpr);
      const xAgora = (PASSADO_MS / JANELA_MS) * w;

      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(243, 235, 220, 0.06)';
      for (let s = Math.ceil(faixa.centro - faixa.span / 2); s <= faixa.centro + faixa.span / 2; s++) {
        const y = Math.round(yDe(s)) + 0.5;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // barras
      const noTraco = notaEm(notas, t - lat);
      for (let i = 0; i < notas.length; i++) {
        const n = notas[i];
        if (n.inicio_ms > t + JANELA_MS - PASSADO_MS || n.inicio_ms + n.dur_ms < t - PASSADO_MS) continue;
        const x1 = xDe(n.inicio_ms);
        const x2 = xDe(n.inicio_ms + n.dur_ms);
        const y = yDe(n.midi) - alturaBarra / 2;
        const razao = acerto[i] / n.dur_ms;
        const acesa = i === noTraco && (historico.current ?? []).some((p) => p.midi !== null && agora - p.t < 120 && erroEmSemitons(p.midi, n.midi) <= 1);
        ctx.save();
        if (n.golden) { ctx.shadowColor = 'rgba(255, 214, 120, 0.85)'; ctx.shadowBlur = 16 * dpr; }
        if (acesa) { ctx.shadowColor = n.golden ? 'rgba(255, 226, 150, 1)' : 'rgba(230, 201, 142, 0.9)'; ctx.shadowBlur = 24 * dpr; }
        barra(ctx, x1, y, Math.max(x2 - x1, alturaBarra * 0.6), alturaBarra);
        ctx.fillStyle = n.golden ? `rgba(255, 207, 94, ${0.5 + 0.5 * razao})` : `rgba(243, 235, 220, ${0.26 + 0.2 * razao})`;
        ctx.fill();
        if (acesa) { ctx.fillStyle = n.golden ? 'rgba(255, 236, 170, 0.95)' : 'rgba(230, 201, 142, 0.92)'; ctx.fill(); }
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1.5 * dpr;
        ctx.strokeStyle = n.golden ? 'rgba(255, 226, 150, 0.95)' : `rgba(230, 201, 142, ${0.35 + 0.5 * razao})`;
        ctx.stroke();
        ctx.restore();
      }

      // linha do agora
      ctx.strokeStyle = 'rgba(230, 201, 142, 0.85)';
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath(); ctx.moveTo(xAgora, 0); ctx.lineTo(xAgora, h); ctx.stroke();

      // tom do microfone (dobrado para a oitava da nota)
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      let anterior: { x: number; y: number; ok: boolean; tp: number } | null = null;
      for (const p of pontos) {
        if (p.midi === null) { anterior = null; continue; }
        const dtp = agora - p.t;
        const st = t - dtp - lat;
        if (st < t - PASSADO_MS) continue;
        const i = notaEm(notas, st);
        const ref = i >= 0 ? notas[i].midi : faixa.centro;
        const dobrado = ref + ((((p.midi - ref + 6) % 12) + 12) % 12) - 6;
        const x = xDe(st);
        const y = yDe(dobrado);
        const ok = i >= 0 && erroEmSemitons(p.midi, notas[i].midi) <= 1;
        if (anterior && p.t - anterior.tp < 120 && Math.abs(anterior.y - y) < h * 0.45) {
          ctx.strokeStyle = ok ? 'rgba(158, 196, 168, 0.95)' : 'rgba(243, 235, 220, 0.7)';
          ctx.shadowColor = ok ? 'rgba(158, 196, 168, 0.8)' : 'transparent';
          ctx.shadowBlur = ok ? 10 * dpr : 0;
          ctx.lineWidth = 4 * dpr;
          ctx.beginPath(); ctx.moveTo(anterior.x, anterior.y); ctx.lineTo(x, y); ctx.stroke();
        }
        anterior = { x, y, ok, tp: p.t };
      }
      ctx.shadowBlur = 0;

      // estrelinhas
      for (let k = brilhos.length - 1; k >= 0; k--) {
        const b = brilhos[k];
        const idade = (agora - b.nasc) / 1100;
        if (idade >= 1) { brilhos.splice(k, 1); continue; }
        ctx.save();
        ctx.globalAlpha = 1 - idade;
        ctx.fillStyle = '#ffe9a8';
        ctx.shadowColor = 'rgba(255, 226, 150, 0.9)';
        ctx.shadowBlur = 12 * dpr;
        estrela(ctx, xAgora + 24 * dpr, yDe(b.y) - alturaBarra - idade * 36 * dpr, (10 + 8 * (1 - idade)) * dpr);
        ctx.fill();
        ctx.restore();
      }
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [linhas, notas, lerMs, historico, latenciaRef, rodando, faixa]);

  const atual = linhas[cena.atual];
  const proxima = linhas[cena.atual + 1];
  return <div className={styles.estPalco}>
    <canvas ref={canvasRef} className={styles.estCanvas} aria-hidden="true" />
    <div className={styles.estLetra} ref={letraRef}>
      {cena.intro || !atual ? <p className={styles.notas}>♪ ♪ ♪</p> : <>
        <div key={`a${cena.atual}`} className={styles.estLinha} aria-label={atual.texto}>
          {atual.palavras.map((p, k) => <span key={k}><span className={styles.estPalavra} data-w={k}>{p.texto}</span>{k < atual.palavras.length - 1 ? ' ' : ''}</span>)}
        </div>
        {proxima ? <div key={`p${cena.atual + 1}`} className={styles.estProxima}>{proxima.texto}</div> : null}
      </>}
    </div>
    {feedback ? <p key={feedback.id} className={styles.estFeedback} role="status">{feedback.texto}</p> : null}
  </div>;
}
