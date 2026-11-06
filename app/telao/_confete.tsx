'use client';
import { useEffect, useRef } from 'react';
import styles from './telao.module.css';

// Confete em canvas, sem dependência. explosao: rajadas fortes + chuva. rajada: algumas rajadas e chuva leve. chuva: só chuva suave.
const CORES = ['#c5292d', '#f3ebdc', '#bfa577', '#607568', '#e8d9a8', '#d94a4e'];

interface Particula { x: number; y: number; vx: number; vy: number; tam: number; rot: number; vrot: number; cor: string; forma: 0 | 1 | 2; fase: number }

export function Confete({ modo }: { modo: 'explosao' | 'rajada' | 'chuva' }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0, h = 0, raf = 0;
    const ajustar = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    ajustar();
    window.addEventListener('resize', ajustar);
    const lado = () => Math.min(w, h);
    const ps: Particula[] = [];
    const nova = (x: number, y: number, vx: number, vy: number): Particula => ({
      x, y, vx, vy, tam: lado() * (0.009 + Math.random() * 0.012), rot: Math.random() * 6.28, vrot: (Math.random() - 0.5) * 0.4,
      cor: CORES[Math.floor(Math.random() * CORES.length)], forma: Math.floor(Math.random() * 3) as 0 | 1 | 2, fase: Math.random() * 6.28,
    });
    const rajada = (cx: number, cy: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2;
        const vel = (0.6 + Math.random()) * lado() * 0.016;
        ps.push(nova(cx, cy, Math.cos(ang) * vel, Math.sin(ang) * vel - lado() * 0.006));
      }
    };
    const chuva = (n: number) => {
      for (let i = 0; i < n; i++) ps.push(nova(Math.random() * w, -lado() * 0.03, (Math.random() - 0.5) * 1.2, lado() * 0.0025 + Math.random() * lado() * 0.003));
    };
    const alvoChuva = modo === 'explosao' ? 230 : modo === 'rajada' ? 90 : 60;
    const totalRajadas = modo === 'explosao' ? 9 : modo === 'rajada' ? 3 : 0;
    let rajadas = 0;
    let proxima = performance.now() + 150;
    let ultimo = performance.now();
    const quadro = (t: number) => {
      const dt = Math.min(50, t - ultimo) / 16.67;
      ultimo = t;
      if (rajadas < totalRajadas && t >= proxima) {
        rajada(w * (0.2 + Math.random() * 0.6), h * (0.25 + Math.random() * 0.3), modo === 'explosao' ? 120 : 70);
        rajadas++; proxima = t + 1100;
      }
      if (ps.length < alvoChuva && Math.random() < 0.6) chuva(2);
      ctx.clearRect(0, 0, w, h);
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.vx *= Math.pow(0.985, dt); p.vy = p.vy * Math.pow(0.99, dt) + lado() * 0.0004 * dt;
        p.fase += 0.06 * dt; p.rot += p.vrot * dt;
        p.x += (p.vx + Math.sin(p.fase) * 0.6) * dt; p.y += p.vy * dt;
        if (p.y > h + 30 || p.x < -40 || p.x > w + 40) { ps.splice(i, 1); continue; }
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.scale(1, Math.abs(Math.cos(p.fase)) * 0.8 + 0.2);
        ctx.fillStyle = p.cor;
        if (p.forma === 0) ctx.fillRect(-p.tam, -p.tam / 2, p.tam * 2, p.tam);
        else if (p.forma === 1) { ctx.beginPath(); ctx.arc(0, 0, p.tam / 1.6, 0, 6.28); ctx.fill(); }
        else { ctx.beginPath(); ctx.moveTo(0, -p.tam); ctx.lineTo(p.tam, p.tam); ctx.lineTo(-p.tam, p.tam); ctx.closePath(); ctx.fill(); }
        ctx.restore();
      }
      raf = requestAnimationFrame(quadro);
    };
    raf = requestAnimationFrame(quadro);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', ajustar); };
  }, [modo]);
  return <canvas ref={ref} className={styles.confete} aria-hidden="true" />;
}
