'use client';

import { useEffect, useRef } from 'react';
import styles from './cenas.module.css';

export interface LareiraCenaProps {
  agora: number;
}

interface Floco {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  fase: number;
  alfa: number;
}

const MAX_FLOCOS = 110;

export function LareiraCena({ agora }: LareiraCenaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0;
    let h = 0;
    let raf = 0;

    const ajustar = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    ajustar();
    window.addEventListener('resize', ajustar);

    const flocos: Floco[] = Array.from({ length: MAX_FLOCOS }, () => ({
      x: Math.random() * (w || 1920),
      y: Math.random() * (h || 1080),
      r: 1.4 + Math.random() * 2.8,
      vy: 0.35 + Math.random() * 0.75,
      vx: (Math.random() - 0.5) * 0.3,
      fase: Math.random() * Math.PI * 2,
      alfa: 0.25 + Math.random() * 0.55,
    }));

    let ultimo = performance.now();
    const desenhar = (t: number) => {
      const dt = Math.min(50, t - ultimo) / 16.67;
      ultimo = t;
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < flocos.length; i++) {
        const f = flocos[i];
        f.fase += 0.02 * dt;
        f.x += (f.vx + Math.sin(f.fase) * 0.25) * dt;
        f.y += f.vy * dt;
        if (f.y > h + 10) {
          f.y = -10;
          f.x = Math.random() * w;
        }
        if (f.x < -10) f.x = w + 10;
        if (f.x > w + 10) f.x = -10;

        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(243, 235, 220, ${f.alfa})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(desenhar);
    };

    raf = requestAnimationFrame(desenhar);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', ajustar);
    };
  }, []);

  const relogio = new Date(agora).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={styles.lareiraCena}>
      <canvas ref={canvasRef} className={styles.neveCanvas} aria-hidden="true" />

      <div className={styles.lareiraCentro} aria-hidden="true">
        <div className={styles.lareiraMoldura}>
          <div className={styles.chamas}>
            <div className={`${styles.chama} ${styles.chamaEsquerda}`} />
            <div className={`${styles.chama} ${styles.chamaDireita}`} />
            <div className={`${styles.chama} ${styles.chamaMaior}`} />
          </div>
          <div className={styles.lenha} />
        </div>
      </div>

      <div className={styles.lareiraRodape}>
        <time className={styles.lareiraRelogio}>{relogio}</time>
        <p className={styles.lareiraSaudacao}>Feliz Natal</p>
      </div>
    </div>
  );
}

export default LareiraCena;
