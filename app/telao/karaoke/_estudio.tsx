'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { erroEmSemitons, type EventoAoVivo, type NotaEstudio, type PontuacaoAoVivo } from './pontuacao';
import type { PontoAltura } from './_pitch';
import type { LinhaEstudio } from './tipos';
import styles from './karaoke.module.css';

/** Janela das barras: 1 s de passado e 3 s de futuro. */
const JANELA_MS = 4000;
const PASSADO_MS = 1000;
const SEGURA_LINHA_MS = 600;
const INTRO_MS = 6000;
const AVALIACAO_MS = 1200;
const MAX_FAISCAS = 200;

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

type Brilho = { nasc: number; midi: number };
type Faisca = { x: number; y: number; vx: number; vy: number; nasc: number; vida: number; cor: string; r: number };
type Rotulo = { nasc: number; x: number; y: number; texto: string; cor: string };

/** Rótulo por nota (acima da barra): do acerto da nota. */
function rotuloDaNota(razao: number): { texto: string; cor: string; faiscas: number } | null {
  if (razao >= 0.9) return { texto: 'Perfeito!', cor: '#ffd45e', faiscas: 18 };
  if (razao >= 0.75) return { texto: 'Ótimo!', cor: '#e6c98e', faiscas: 12 };
  if (razao >= 0.5) return { texto: 'Bom!', cor: '#9ec4a8', faiscas: 7 };
  if (razao >= 0.25) return { texto: 'Quase', cor: '#cfc6b6', faiscas: 3 };
  return null;
}

/** Avaliação por frase, grande no meio da tela (estilo Lips). */
function avaliacaoDaFrase(perfeicao: number): { texto: string; cor: string } {
  if (perfeicao >= 0.9) return { texto: 'PERFEITO!', cor: '#ffd45e' };
  if (perfeicao >= 0.75) return { texto: 'ÓTIMO!', cor: '#e6c98e' };
  if (perfeicao >= 0.5) return { texto: 'BOM!', cor: '#9ec4a8' };
  if (perfeicao >= 0.25) return { texto: 'QUASE!', cor: '#cfc6b6' };
  return { texto: 'ERROU', cor: '#e07a7d' };
}

type Avaliacao = { id: number; texto: string; cor: string; pontos: number };
type ComboVisual = { n: number; seq: number; quebra: number };

/**
 * Cena do modo estúdio: barras de notas rolando (estilo SingStar) com o tom do microfone por cima, placar ao vivo, sequência (combo),
 * avaliação por nota e por frase e, embaixo, a letra palavra a palavra.
 * lerMs: instante da música em ms já com o ajuste de sincronia. historico: altura da voz medida pelo microfone (performance.now).
 * motor: pontuação ao vivo (alimentada pelo microfone no componente pai). eventos: fila de acontecimentos do motor, esvaziada aqui.
 * O desenho, as partículas e o preenchimento rodam em requestAnimationFrame direto no canvas e no DOM; o React só renderiza quando algo discreto muda.
 */
export function PalcoEstudio({ linhas, notas, lerMs, historico, latenciaRef, offsetRef, rodando, motor, eventos, micAtivo }: {
  linhas: readonly LinhaEstudio[];
  notas: readonly NotaEstudio[];
  lerMs: () => number;
  historico: RefObject<PontoAltura[]>;
  latenciaRef: RefObject<number>;
  offsetRef: RefObject<number>;
  rodando: () => boolean;
  motor: RefObject<PontuacaoAoVivo | null>;
  eventos: RefObject<EventoAoVivo[]>;
  micAtivo: () => boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const letraRef = useRef<HTMLDivElement>(null);
  const pontosRef = useRef<HTMLParagraphElement>(null);
  const notaRef = useRef<HTMLSpanElement>(null);
  const [cena, setCena] = useState<{ atual: number; intro: boolean }>({ atual: 0, intro: false });
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const [combo, setCombo] = useState<ComboVisual>({ n: 1, seq: 0, quebra: 0 });

  const faixa = useMemo(() => {
    if (!notas.length) return { centro: 60, span: 12 };
    let lo = Infinity;
    let hi = -Infinity;
    for (const n of notas) { lo = Math.min(lo, n.midi); hi = Math.max(hi, n.midi); }
    return { centro: (lo + hi) / 2, span: Math.max(hi - lo + 4, 12) };
  }, [notas]);

  useEffect(() => {
    if (!avaliacao) return;
    const t = window.setTimeout(() => setAvaliacao(null), AVALIACAO_MS);
    return () => window.clearTimeout(t);
  }, [avaliacao]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let chave = '';
    let ultimoAgora = performance.now();
    let ultimoFrame = performance.now();
    let exibido = 0;
    let textoPontos = '';
    let textoNota = '';
    let seqAvaliacao = 0;
    const brilhos: Brilho[] = [];
    const faiscas: Faisca[] = [];
    const rotulos: Rotulo[] = [];

    const soltarFaiscas = (x: number, y: number, qtd: number, cor: string, dpr: number) => {
      for (let k = 0; k < qtd; k++) {
        const ang = Math.random() * Math.PI * 2;
        const v = (60 + Math.random() * 180) * dpr;
        faiscas.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - 60 * dpr, nasc: performance.now(), vida: 500 + Math.random() * 600, cor: Math.random() < 0.6 ? cor : '#fff3c4', r: (1.5 + Math.random() * 2.5) * dpr });
      }
      if (faiscas.length > MAX_FAISCAS) faiscas.splice(0, faiscas.length - MAX_FAISCAS);
    };

    const passo = () => {
      raf = requestAnimationFrame(passo);
      const tocando = rodando();
      const agora = tocando ? performance.now() : ultimoAgora;
      ultimoAgora = agora;
      const real = performance.now();
      const dtSeg = Math.min(0.1, (real - ultimoFrame) / 1000);
      ultimoFrame = real;
      const t = lerMs();
      const lat = latenciaRef.current ?? 0;
      const m = motor.current;

      // ----- letra: qual linha mostrar e preenchimento palavra a palavra -----
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

      // ----- geometria do canvas -----
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      const pad = h * 0.06;
      const util = h - pad * 2;
      const yDe = (midi: number) => pad + (1 - (midi - (faixa.centro - faixa.span / 2)) / faixa.span) * util;
      const xDe = (ms: number) => ((ms - t + PASSADO_MS) / JANELA_MS) * w;
      const alturaBarra = limitar(util / faixa.span * 0.85, 8 * dpr, 34 * dpr);
      const xAgora = (PASSADO_MS / JANELA_MS) * w;

      // ----- acontecimentos do motor de pontuação -----
      const fila = eventos.current;
      while (fila.length) {
        const e = fila.shift();
        if (!e) break;
        if (e.tipo === 'estrela') brilhos.push({ nasc: agora, midi: notas[e.indice]?.midi ?? faixa.centro });
        else if (e.tipo === 'nota') {
          setCombo((c) => ({ n: e.combo, seq: e.sequencia, quebra: e.quebrou ? c.quebra + 1 : c.quebra }));
          const rot = rotuloDaNota(e.razao);
          const n = notas[e.indice];
          if (rot && n && w > 0) {
            const y = yDe(n.midi) - alturaBarra;
            rotulos.push({ nasc: real, x: xAgora, y, texto: rot.texto, cor: rot.cor });
            soltarFaiscas(xAgora, yDe(n.midi), Math.round(rot.faiscas * (e.golden ? 1.5 : 1)), rot.cor, dpr);
            if (rotulos.length > 8) rotulos.shift();
          }
        } else if (e.tipo === 'linha' && micAtivo()) {
          const av = avaliacaoDaFrase(e.perfeicao);
          setAvaliacao({ id: ++seqAvaliacao, texto: av.texto, cor: av.cor, pontos: e.pontos });
        }
      }

      // ----- placar: contador rolando -----
      if (m) {
        const est = m.estado();
        exibido += (est.pontos - exibido) * Math.min(1, dtSeg * 6);
        if (Math.abs(est.pontos - exibido) < 1) exibido = est.pontos;
        const tp = Math.round(exibido).toLocaleString('pt-BR');
        if (tp !== textoPontos && pontosRef.current) { textoPontos = tp; pontosRef.current.textContent = tp; }
        const tn = String(Math.round(limitar(exibido / 100, 0, 100)));
        if (tn !== textoNota && notaRef.current) { textoNota = tn; notaRef.current.textContent = tn; }
      }

      // ----- canvas -----
      if (!w || !h) return;
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      ctx.clearRect(0, 0, w, h);

      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(243, 235, 220, 0.06)';
      for (let s = Math.ceil(faixa.centro - faixa.span / 2); s <= faixa.centro + faixa.span / 2; s++) {
        const y = Math.round(yDe(s)) + 0.5;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // barras: o preenchimento é proporcional ao acerto da nota
      const uq = m?.ultimoQuadro;
      const bruto = t + (offsetRef.current ?? 0);
      for (let i = 0; i < notas.length; i++) {
        const n = notas[i];
        if (n.inicio_ms > t + JANELA_MS - PASSADO_MS || n.inicio_ms + n.dur_ms < t - PASSADO_MS) continue;
        const x1 = xDe(n.inicio_ms);
        const x2 = xDe(n.inicio_ms + n.dur_ms);
        const larg = Math.max(x2 - x1, alturaBarra * 0.6);
        const y = yDe(n.midi) - alturaBarra / 2;
        const razao = m ? m.razaoDaNota(i) : 0;
        const acesa = Boolean(uq && uq.indice === i && uq.valido && uq.fator >= 0.5 && Math.abs(bruto - uq.ms) < 200);
        ctx.save();
        if (n.golden) { ctx.shadowColor = 'rgba(255, 214, 120, 0.8)'; ctx.shadowBlur = 18 * dpr; }
        if (acesa) { ctx.shadowColor = n.golden ? 'rgba(255, 232, 160, 1)' : 'rgba(230, 201, 142, 0.9)'; ctx.shadowBlur = 26 * dpr; }
        barra(ctx, x1, y, larg, alturaBarra);
        ctx.fillStyle = n.golden ? 'rgba(255, 207, 94, 0.22)' : 'rgba(243, 235, 220, 0.2)';
        ctx.fill();
        ctx.shadowBlur = 0;
        if (razao > 0.005) {
          ctx.save();
          barra(ctx, x1, y, larg, alturaBarra);
          ctx.clip();
          ctx.fillStyle = n.golden ? (acesa ? '#fff0b0' : '#ffd45e') : (acesa ? '#f3dca4' : '#e6c98e');
          ctx.fillRect(x1, y, larg * razao, alturaBarra);
          ctx.restore();
        }
        barra(ctx, x1, y, larg, alturaBarra);
        ctx.lineWidth = (n.golden ? 2.2 : 1.5) * dpr;
        ctx.strokeStyle = n.golden ? 'rgba(255, 226, 150, 0.95)' : `rgba(230, 201, 142, ${0.4 + 0.5 * razao})`;
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
      const pontos = historico.current ?? [];
      let anterior: { x: number; y: number; tp: number } | null = null;
      for (const p of pontos) {
        if (p.midi === null) { anterior = null; continue; }
        const st = t - (agora - p.t) - lat;
        if (st < t - PASSADO_MS) continue;
        const i = notas.findIndex((n) => st >= n.inicio_ms && st < n.inicio_ms + n.dur_ms);
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
        anterior = { x, y, tp: p.t };
      }
      ctx.shadowBlur = 0;

      // estrelinhas (nota passou de 80% de acerto)
      for (let k = brilhos.length - 1; k >= 0; k--) {
        const b = brilhos[k];
        const idade = (agora - b.nasc) / 1100;
        if (idade >= 1) { brilhos.splice(k, 1); continue; }
        ctx.save();
        ctx.globalAlpha = 1 - idade;
        ctx.fillStyle = '#ffe9a8';
        ctx.shadowColor = 'rgba(255, 226, 150, 0.9)';
        ctx.shadowBlur = 12 * dpr;
        estrela(ctx, xAgora + 24 * dpr, yDe(b.midi) - alturaBarra - idade * 36 * dpr, (10 + 8 * (1 - idade)) * dpr);
        ctx.fill();
        ctx.restore();
      }

      // faíscas douradas
      if (faiscas.length) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let k = faiscas.length - 1; k >= 0; k--) {
          const f = faiscas[k];
          const idade = (real - f.nasc) / f.vida;
          if (idade >= 1) { faiscas.splice(k, 1); continue; }
          f.x += f.vx * dtSeg; f.y += f.vy * dtSeg; f.vy += 260 * dpr * dtSeg;
          ctx.globalAlpha = 1 - idade;
          ctx.fillStyle = f.cor;
          ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - idade * 0.5), 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }

      // rótulos flutuantes por nota
      if (rotulos.length) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `800 ${Math.round(20 * dpr)}px Manrope, system-ui, sans-serif`;
        for (let k = rotulos.length - 1; k >= 0; k--) {
          const r = rotulos[k];
          const idade = (real - r.nasc) / 1100;
          if (idade >= 1) { rotulos.splice(k, 1); continue; }
          ctx.globalAlpha = idade < 0.15 ? idade / 0.15 : 1 - Math.max(0, (idade - 0.5) / 0.5);
          ctx.lineWidth = 4 * dpr;
          ctx.strokeStyle = 'rgba(23, 27, 24, 0.85)';
          ctx.fillStyle = r.cor;
          const yy = r.y - idade * 34 * dpr - 6 * dpr;
          ctx.strokeText(r.texto, r.x, yy);
          ctx.fillText(r.texto, r.x, yy);
        }
        ctx.restore();
      }
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [linhas, notas, lerMs, historico, latenciaRef, offsetRef, rodando, motor, eventos, micAtivo, faixa]);

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

    <div className={styles.estPlacar} aria-label="Placar ao vivo">
      <div key={`c${combo.n}`} className={`${styles.estCombo} ${combo.n > 1 ? styles.estComboAceso : ''}`} data-nivel={combo.n} title="Notas seguidas acima de 60%: 5 = x2, 10 = x3, 20 = x4">
        <span className={styles.estComboX}>x{combo.n}</span>
        <span className={styles.estComboSeq}>{combo.seq > 0 ? `${combo.seq} seguidas` : 'sequência'}</span>
        {combo.quebra > 0 && combo.n === 1 ? <span key={`q${combo.quebra}`} className={styles.estQuebra}>quebrou</span> : null}
      </div>
      <div className={styles.estPontosCaixa}>
        <p className={styles.estPontos} ref={pontosRef}>0</p>
        <p className={styles.estNotaMini}>nota <span ref={notaRef}>0</span></p>
      </div>
    </div>

    {avaliacao ? <div key={avaliacao.id} className={styles.estAvaliacao} role="status">
      <p className={styles.estAvaliacaoTexto} style={{ color: avaliacao.cor }}>{avaliacao.texto}</p>
      {avaliacao.pontos > 0 ? <p className={styles.estGanho}>+{avaliacao.pontos.toLocaleString('pt-BR')}</p> : null}
    </div> : null}
  </div>;
}
