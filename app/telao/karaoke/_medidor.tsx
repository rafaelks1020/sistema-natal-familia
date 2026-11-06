'use client';
import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { desvioCents, nomeDaNota, type PontoAltura, type Vivo } from './_pitch';

// Medidor de afinação: linha contínua da altura cantada rolando para a esquerda, grade de semitons e barra de volume.
const JANELA_MS = 8000;
const SEMITONS_VISIVEIS = 15;
const NATURAIS = new Set([0, 2, 4, 5, 7, 9, 11]);
const COR_FIRME = '#8fb39a';
const COR_PERTO = '#bfa577';
const COR_LONGE = '#d94a4e';

const corDe = (midi: number) => {
  const c = desvioCents(midi);
  return c <= 15 ? COR_FIRME : c <= 30 ? COR_PERTO : COR_LONGE;
};

/** rms (0 a 1) para 0 a 1 numa escala de decibéis (-60 dB a -6 dB). */
const nivelDe = (rms: number) => Math.min(1, Math.max(0, (20 * Math.log10(Math.max(rms, 1e-5)) + 60) / 54));

export function MedidorAfinacao({ vivo, historico }: { vivo: MutableRefObject<Vivo>; historico: MutableRefObject<PontoAltura[]> }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0, h = 0, raf = 0;
    let centro = 60;
    let nivelSuave = 0;
    const ajustar = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(canvas);

    const quadro = () => {
      const agora = performance.now();
      const v = vivo.current;
      const pontos = historico.current;
      if (v.midi !== null) centro += (v.midi - centro) * 0.04;
      nivelSuave += (nivelDe(v.rms) - nivelSuave) * 0.35;
      const barraW = Math.max(14, w * 0.085);
      const areaW = w - barraW - 10;
      const cabecaX = areaW * 0.84;
      const yDe = (m: number) => h / 2 - ((m - centro) / SEMITONS_VISIVEIS) * h;
      const xDe = (t: number) => cabecaX - ((agora - t) / JANELA_MS) * cabecaX;

      ctx.clearRect(0, 0, w, h);
      // grade de semitons
      ctx.font = `600 ${Math.max(10, h * 0.035)}px sans-serif`;
      ctx.textBaseline = 'middle';
      const base = Math.floor(centro - SEMITONS_VISIVEIS / 2) - 1;
      for (let m = base; m <= base + SEMITONS_VISIVEIS + 2; m++) {
        const y = yDe(m);
        if (y < -4 || y > h + 4) continue;
        const natural = NATURAIS.has(((m % 12) + 12) % 12);
        ctx.strokeStyle = natural ? 'rgba(243, 235, 220, 0.16)' : 'rgba(243, 235, 220, 0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(areaW, y); ctx.stroke();
        if (natural) { ctx.fillStyle = 'rgba(243, 235, 220, 0.5)'; ctx.fillText(nomeDaNota(m), 6, y - h * 0.022); }
      }
      // faixa-alvo: o semitom mais próximo da voz
      if (v.midi !== null) {
        const alvo = Math.round(v.midi);
        const grad = ctx.createLinearGradient(0, yDe(alvo + 0.5), 0, yDe(alvo - 0.5));
        grad.addColorStop(0, 'rgba(143, 179, 154, 0)'); grad.addColorStop(0.5, 'rgba(143, 179, 154, 0.22)'); grad.addColorStop(1, 'rgba(143, 179, 154, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, yDe(alvo + 0.5), areaW, yDe(alvo - 0.5) - yDe(alvo + 0.5));
      }
      // linha da voz
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(3, h * 0.016);
      let ant: PontoAltura | null = null;
      for (const p of pontos) {
        if (p.midi !== null && ant && ant.midi !== null && p.t - ant.t < 120) {
          const cor = corDe(p.midi);
          ctx.strokeStyle = cor; ctx.shadowColor = cor; ctx.shadowBlur = h * 0.02;
          ctx.beginPath(); ctx.moveTo(xDe(ant.t), yDe(ant.midi)); ctx.lineTo(xDe(p.t), yDe(p.midi)); ctx.stroke();
        }
        ant = p;
      }
      ctx.shadowBlur = 0;
      // cabeça e nota atual
      if (v.midi !== null) {
        const cor = corDe(v.midi);
        const y = yDe(v.midi);
        ctx.fillStyle = cor; ctx.shadowColor = cor; ctx.shadowBlur = h * 0.04;
        ctx.beginPath(); ctx.arc(cabecaX, y, Math.max(5, h * 0.022), 0, 6.283); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#f3ebdc';
        ctx.font = `800 ${Math.max(14, h * 0.07)}px sans-serif`;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(nomeDaNota(v.midi), Math.min(cabecaX + 14, areaW - h * 0.12), Math.max(h * 0.09, Math.min(h - 8, y - 10)));
      }
      // barra de volume
      const bx = w - barraW, by = 10, bh = h - 20;
      ctx.fillStyle = 'rgba(243, 235, 220, 0.1)';
      ctx.beginPath(); ctx.roundRect(bx, by, barraW - 6, bh, 6); ctx.fill();
      const altura = bh * nivelSuave;
      const g = ctx.createLinearGradient(0, by + bh, 0, by);
      g.addColorStop(0, '#607568'); g.addColorStop(0.65, '#bfa577'); g.addColorStop(1, '#c5292d');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.roundRect(bx, by + bh - altura, barraW - 6, altura, 6); ctx.fill();
      const yl = by + bh - bh * nivelDe(v.limiar);
      ctx.strokeStyle = 'rgba(243, 235, 220, 0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bx - 3, yl); ctx.lineTo(bx + barraW - 3, yl); ctx.stroke();
      raf = requestAnimationFrame(quadro);
    };
    raf = requestAnimationFrame(quadro);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [vivo, historico]);

  return <canvas ref={ref} aria-label="Medidor de afinação e volume da voz" role="img" />;
}
