'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
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

interface Brasa {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  vida: number;
  fase: number;
}

const MAX_FLOCOS = 80;
const MAX_BRASAS = 40;

/** Línguas de fogo: x e escala (largura, altura) no SVG, duração e atraso do bruxuleio. */
const LINGUAS = [
  { x: 315, sx: 0.95, sy: 1.15, dur: 1.5, atraso: -0.4, b: false },
  { x: 485, sx: 0.9, sy: 1.1, dur: 1.7, atraso: -1.1, b: true },
  { x: 355, sx: 1.25, sy: 1.55, dur: 1.9, atraso: -0.9, b: true },
  { x: 445, sx: 1.2, sy: 1.5, dur: 1.4, atraso: -0.2, b: false },
  { x: 400, sx: 1.5, sy: 1.95, dur: 2.1, atraso: -1.4, b: false },
] as const;

/** Camadas de uma língua: escala sobre a base, cor (id do gradiente) e variação de tempo. */
const CAMADAS = [
  { e: 1, g: 'gVermelho', k: 1 },
  { e: 0.8, g: 'gLaranja', k: 0.83 },
  { e: 0.58, g: 'gAmarelo', k: 1.17 },
  { e: 0.34, g: 'gNucleo', k: 0.9 },
] as const;

const FLAMA = 'M -28 0 C -40 -34 -14 -60 -8 -92 C -6 -104 -2 -112 2 -128 C 10 -108 14 -100 22 -82 C 36 -56 40 -26 28 0 Z';

const MEIAS = [
  { x: 130, cor: '#c5292d', punho: '#f3ebdc', detalhe: '#bfa577', atraso: -0.8 },
  { x: 360, cor: '#607568', punho: '#f3ebdc', detalhe: '#c5292d', atraso: -2.6 },
  { x: 585, cor: '#bfa577', punho: '#c5292d', detalhe: '#f3ebdc', atraso: -4.1 },
] as const;

function Meia({ x, cor, punho, detalhe, atraso }: (typeof MEIAS)[number]) {
  return (
    <g transform={`translate(${x} 84) scale(0.85)`}>
      <g className={styles.meia} style={{ '--atraso': `${atraso}s` } as CSSProperties}>
        <circle cx="23" cy="-6" r="4" fill="#bfa577" />
        <path d="M 2 16 L 44 16 L 44 74 Q 44 92 60 100 L 84 112 Q 98 120 92 136 Q 84 150 68 144 L 20 120 Q 2 110 2 90 Z" fill={cor} />
        <path d="M 66 124 Q 84 128 92 136 Q 84 150 68 144 Q 60 134 66 124 Z" fill={detalhe} />
        <ellipse cx="14" cy="86" rx="5" ry="9" fill={detalhe} opacity="0.85" />
        <rect x="-2" y="0" width="52" height="20" rx="5" fill={punho} />
        <path d="M 2 12 H 46" stroke="rgba(0,0,0,0.12)" strokeWidth="2" />
      </g>
    </g>
  );
}

export function LareiraCena({ agora }: LareiraCenaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lareiraRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0;
    let h = 0;
    let fx = 0;
    let fy = 0;
    let fl = 0;
    let raf = 0;

    const ajustar = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const r = lareiraRef.current?.getBoundingClientRect();
      const c = canvas.getBoundingClientRect();
      if (r) {
        // Boca da lareira (viewBox 800x570): centro x=400, base y=490, largura útil ~170.
        fx = r.left - c.left + r.width * 0.5;
        fy = r.top - c.top + r.height * (490 / 570);
        fl = r.width * (170 / 800);
      }
    };
    ajustar();
    window.addEventListener('resize', ajustar);

    const flocos: Floco[] = Array.from({ length: MAX_FLOCOS }, () => ({
      x: Math.random() * (w || 1920),
      y: Math.random() * (h || 1080),
      r: 1.4 + Math.random() * 2.6,
      vy: 0.35 + Math.random() * 0.7,
      vx: (Math.random() - 0.5) * 0.3,
      fase: Math.random() * Math.PI * 2,
      alfa: 0.22 + Math.random() * 0.5,
    }));

    const novaBrasa = (inicial: boolean): Brasa => ({
      x: fx + (Math.random() - 0.5) * 2 * fl,
      y: fy - Math.random() * (inicial ? h * 0.35 : 14),
      vx: (Math.random() - 0.5) * 0.5,
      vy: 0.9 + Math.random() * 1.7,
      r: 1.1 + Math.random() * 2.1,
      vida: inicial ? Math.random() : 0,
      fase: Math.random() * Math.PI * 2,
    });
    const brasas: Brasa[] = Array.from({ length: MAX_BRASAS }, () => novaBrasa(true));

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

      for (let i = 0; i < brasas.length; i++) {
        let b = brasas[i];
        b.fase += 0.07 * dt;
        b.vida += 0.0046 * dt;
        b.x += (b.vx + Math.sin(b.fase) * 0.45) * dt;
        b.y -= b.vy * dt;
        if (b.vida >= 1) {
          b = novaBrasa(false);
          brasas[i] = b;
        }
        const a = Math.sin(Math.min(1, b.vida) * Math.PI) * (0.65 + Math.sin(b.fase * 2.3) * 0.25);
        const quente = 1 - b.vida;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 2.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, ${Math.round(90 + 70 * quente)}, 30, ${(a * 0.16).toFixed(3)})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, ${Math.round(170 + 60 * quente)}, ${Math.round(70 + 60 * quente)}, ${a.toFixed(3)})`;
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
      <div className={styles.lareiraChao} aria-hidden="true" />
      <div className={styles.lareiraBrilhoChao} aria-hidden="true" />
      <canvas ref={canvasRef} className={styles.neveCanvas} aria-hidden="true" />

      <div className={styles.lareiraTopo}>
        <p className={styles.lareiraSaudacao}>Feliz Natal</p>
        <time className={styles.lareiraRelogio}>{relogio}</time>
      </div>

      <svg ref={lareiraRef} className={styles.lareiraSvg} viewBox="0 0 800 570" aria-hidden="true">
        <defs>
          <pattern id="lrTijolos" width="80" height="44" patternUnits="userSpaceOnUse">
            <rect width="80" height="44" fill="#1c1412" />
            <rect x="2" y="2" width="36" height="18" rx="2" fill="#4a2a24" />
            <rect x="42" y="2" width="36" height="18" rx="2" fill="#3d231f" />
            <rect x="-18" y="24" width="36" height="18" rx="2" fill="#3d231f" />
            <rect x="22" y="24" width="36" height="18" rx="2" fill="#52302a" />
            <rect x="62" y="24" width="36" height="18" rx="2" fill="#3d231f" />
          </pattern>
          <linearGradient id="lrConsolo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7a5233" />
            <stop offset="0.35" stopColor="#5a3a24" />
            <stop offset="1" stopColor="#35200f" />
          </linearGradient>
          <linearGradient id="lrPedra" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6a5b50" />
            <stop offset="1" stopColor="#3b312b" />
          </linearGradient>
          <linearGradient id="lrLenha" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6b4529" />
            <stop offset="0.55" stopColor="#442a18" />
            <stop offset="1" stopColor="#24160c" />
          </linearGradient>
          <radialGradient id="lrFundoFogo" cx="0.5" cy="1" r="0.9">
            <stop offset="0" stopColor="#7a2a12" />
            <stop offset="0.5" stopColor="#2a0f0a" />
            <stop offset="1" stopColor="#0c0807" />
          </radialGradient>
          <radialGradient id="lrBrilhoBoca" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffb14a" stopOpacity="0.85" />
            <stop offset="0.5" stopColor="#e8651f" stopOpacity="0.3" />
            <stop offset="1" stopColor="#c5292d" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="lrSombra" cx="0.5" cy="0.62" r="0.75">
            <stop offset="0.35" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.7" />
          </radialGradient>
          <linearGradient id="gVermelho" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e8452a" />
            <stop offset="1" stopColor="#a82024" />
          </linearGradient>
          <linearGradient id="gLaranja" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff9a2e" />
            <stop offset="1" stopColor="#e8651f" />
          </linearGradient>
          <linearGradient id="gAmarelo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd45e" />
            <stop offset="1" stopColor="#ffa93a" />
          </linearGradient>
          <linearGradient id="gNucleo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff6d8" />
            <stop offset="1" stopColor="#ffe08a" />
          </linearGradient>
          <clipPath id="lrBoca">
            <path d="M 250 530 V 214 Q 250 200 264 200 H 536 Q 550 200 550 214 V 530 Z" />
          </clipPath>
          <clipPath id="lrFace">
            <rect x="100" y="70" width="600" height="460" />
          </clipPath>
        </defs>

        {/* Parede de tijolos */}
        <rect x="100" y="70" width="600" height="460" fill="url(#lrTijolos)" />
        <g clipPath="url(#lrFace)">
          <rect x="100" y="70" width="600" height="460" fill="url(#lrSombra)" />
          <ellipse className={styles.brilhoFace} cx="400" cy="470" rx="380" ry="300" fill="url(#lrBrilhoBoca)" />
        </g>

        {/* Moldura de pedra e boca */}
        <path d="M 236 530 V 200 Q 236 186 250 186 H 550 Q 564 186 564 200 V 530 Z" fill="url(#lrPedra)" />
        <path d="M 250 530 V 214 Q 250 200 264 200 H 536 Q 550 200 550 214 V 530 Z" fill="url(#lrFundoFogo)" />

        <g clipPath="url(#lrBoca)">
          <ellipse className={styles.brilhoFace} cx="400" cy="500" rx="170" ry="90" fill="url(#lrBrilhoBoca)" />

          {/* Línguas de fogo em camadas */}
          {LINGUAS.map((l, i) => (
            <g key={i} transform={`translate(${l.x} 512) scale(${l.sx} ${l.sy})`}>
              {CAMADAS.map((c, j) => (
                <g key={j} transform={`scale(${c.e})`}>
                  <path
                    d={FLAMA}
                    fill={`url(#${c.g})`}
                    className={`${styles.chama} ${(l.b ? j % 2 === 0 : j % 2 === 1) ? styles.chamaB : ''}`}
                    style={{ '--dur': `${(l.dur * c.k).toFixed(2)}s`, '--atraso': `${(l.atraso * c.k).toFixed(2)}s` } as CSSProperties}
                  />
                </g>
              ))}
            </g>
          ))}

          {/* Toras cruzadas */}
          <g transform="translate(400 506) rotate(-9)">
            <rect x="-135" y="-17" width="270" height="34" rx="16" fill="url(#lrLenha)" />
            <path d="M -110 -6 H 100 M -100 6 H 110" stroke="#1b1109" strokeWidth="2" opacity="0.6" />
            <ellipse cx="135" cy="0" rx="9" ry="16" fill="#7b5535" stroke="#2a1a10" strokeWidth="2" />
            <ellipse cx="135" cy="0" rx="4" ry="9" fill="none" stroke="#4a301c" strokeWidth="1.5" />
            <rect className={styles.brasa} x="-120" y="10" width="230" height="5" rx="2.5" fill="#ff7a2a" />
          </g>
          <g transform="translate(400 508) rotate(10)">
            <rect x="-135" y="-17" width="270" height="34" rx="16" fill="url(#lrLenha)" />
            <path d="M -105 -5 H 105 M -95 7 H 115" stroke="#1b1109" strokeWidth="2" opacity="0.6" />
            <ellipse cx="-135" cy="0" rx="9" ry="16" fill="#7b5535" stroke="#2a1a10" strokeWidth="2" />
            <ellipse cx="-135" cy="0" rx="4" ry="9" fill="none" stroke="#4a301c" strokeWidth="1.5" />
            <rect className={styles.brasa} x="-110" y="10" width="220" height="5" rx="2.5" fill="#ff8a30" style={{ animationDelay: '-0.9s' }} />
          </g>
          <g transform="translate(400 524)">
            <rect x="-150" y="-16" width="300" height="30" rx="15" fill="#2c1b10" />
            <rect x="-150" y="-16" width="300" height="12" rx="6" fill="#4a2f1b" opacity="0.7" />
            <rect className={styles.brasa} x="-130" y="-20" width="260" height="6" rx="3" fill="#ff6a24" style={{ animationDelay: '-0.4s' }} />
          </g>
        </g>

        {/* Soleira de pedra */}
        <rect x="70" y="528" width="660" height="30" rx="5" fill="url(#lrPedra)" />
        <rect x="70" y="528" width="660" height="3" fill="rgba(243, 235, 220, 0.18)" />

        {/* Consolo de madeira */}
        <rect x="70" y="62" width="660" height="14" rx="3" fill="#2c1a0e" />
        <rect x="50" y="22" width="700" height="42" rx="7" fill="url(#lrConsolo)" />
        <rect x="52" y="24" width="696" height="3" rx="1.5" fill="rgba(243, 235, 220, 0.25)" />

        {/* Meias penduradas */}
        {MEIAS.map((m) => <Meia key={m.x} {...m} />)}
      </svg>
    </div>
  );
}

export default LareiraCena;
