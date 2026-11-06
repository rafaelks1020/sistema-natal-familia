'use client';

import styles from './cenas.module.css';
import { MUNDO_PONTOS } from './mundo-pontos';

export interface PapaiNoelCenaProps {
  agora: number;
}

interface EstadoRota {
  frase: string;
  progresso: number;
  milhoes: number;
  pos: { x: number; y: number };
}

/** Rota no mapa de pontos (viewBox 360 x 152: x = longitude + 180, y = 90 - latitude). */
const PONTOS_ROTA: { x: number; y: number }[] = [
  { x: 232, y: 6 },   // Polo Norte
  { x: 290, y: 50 },  // Ásia
  { x: 192, y: 42 },  // Europa
  { x: 206, y: 92 },  // África
  { x: 128, y: 102 }, // Brasil
];

function interpolarRota(p: number): { x: number; y: number } {
  if (p <= 0) return PONTOS_ROTA[0];
  if (p >= 1) return PONTOS_ROTA[PONTOS_ROTA.length - 1];
  const segs = PONTOS_ROTA.length - 1;
  const exato = p * segs;
  const idx = Math.min(segs - 1, Math.floor(exato));
  const frac = exato - idx;
  const a = PONTOS_ROTA[idx];
  const b = PONTOS_ROTA[idx + 1];
  return {
    x: Math.round((a.x + (b.x - a.x) * frac) * 10) / 10,
    y: Math.round((a.y + (b.y - a.y) * frac) * 10) / 10,
  };
}

/** Pontos da rota já percorrida, terminando na posição atual do trenó. */
function rastroAte(progresso: number, pos: { x: number; y: number }): string {
  const segs = PONTOS_ROTA.length - 1;
  const feitos = Math.floor(Math.min(1, Math.max(0, progresso)) * segs);
  const pts = PONTOS_ROTA.slice(0, feitos + 1).map((p) => `${p.x},${p.y}`);
  pts.push(`${pos.x},${pos.y}`);
  return pts.join(' ');
}

// Mapa de pontos desenhado uma vez (2400+ círculos): fora do render do relógio.
const MAPA_PONTOS = (
  <g fill="#607568" opacity="0.62">
    {MUNDO_PONTOS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="0.62" />)}
  </g>
);

function calcularEstadoNoel(agora: number): EstadoRota {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date(agora));

  const pegar = (tipo: Intl.DateTimeFormatPartTypes) =>
    Number(partes.find((p) => p.type === tipo)?.value ?? 0);

  const mes = pegar('month');
  const dia = pegar('day');
  const hora = pegar('hour') % 24;
  const min = pegar('minute');
  const seg = pegar('second');
  const segDoDia = hora * 3600 + min * 60 + seg;

  // Depois da meia-noite de 24 para 25 de dezembro
  if (mes === 12 && dia >= 25) {
    const extra = Math.min(800, Math.floor(segDoDia / 30));
    return {
      frase: 'Papai Noel já passou por aqui!',
      progresso: 1,
      milhoes: 1950 + extra,
      pos: PONTOS_ROTA[PONTOS_ROTA.length - 1],
    };
  }

  // Dia 24 de dezembro das 18h até 0h
  if (mes === 12 && dia === 24 && hora >= 18) {
    const dec = segDoDia - 18 * 3600;
    const duracao = 6 * 3600;
    const progresso = Math.min(1, Math.max(0, dec / duracao));
    const milhoes = Math.max(12, Math.round(120 + progresso * 1830));
    return {
      frase: 'Papai Noel está cruzando o mundo rumo ao Brasil!',
      progresso,
      milhoes,
      pos: interpolarRota(progresso),
    };
  }

  // Antes das 18h do dia 24: crescendo devagar com o relógio para encantar as crianças
  const baseMilhoes = 15 + (Math.floor(Math.max(0, agora) / 4000) % 95);
  return {
    frase: 'Papai Noel está se preparando no Polo Norte',
    progresso: 0,
    milhoes: baseMilhoes,
    pos: PONTOS_ROTA[0],
  };
}

export function PapaiNoelCena({ agora }: PapaiNoelCenaProps) {
  const { frase, milhoes, pos, progresso } = calcularEstadoNoel(agora);
  const rastro = rastroAte(progresso, pos);

  return (
    <div className={`${styles.cena} ${styles.noelCena}`}>
      <p className={styles.kicker}>Rastreador do Polo Norte</p>
      <h2 className={styles.titulo}>{frase}</h2>

      <div className={styles.noelMapaBox}>
        <svg viewBox="0 0 360 152" className={styles.noelSvg} aria-label="Mapa da viagem do Papai Noel">
          <defs>
            <filter id="noelBrilho" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.6" />
            </filter>
          </defs>

          {MAPA_PONTOS}

          {/* Rota completa, tracejada */}
          <polyline
            points={PONTOS_ROTA.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#bfa577"
            strokeWidth="0.6"
            strokeDasharray="1.6 2.2"
            strokeLinecap="round"
            opacity="0.5"
          />

          {/* Rastro brilhante já percorrido */}
          <polyline points={rastro} fill="none" stroke="#c5292d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" filter="url(#noelBrilho)" />
          <polyline points={rastro} fill="none" stroke="#f3ebdc" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" />

          {/* Polo Norte */}
          <circle cx={PONTOS_ROTA[0].x} cy={PONTOS_ROTA[0].y} r="2.2" fill="#f3ebdc" />
          <text x={PONTOS_ROTA[0].x + 5} y={PONTOS_ROTA[0].y + 3} fill="#cfc6b6" fontSize="8" fontWeight="700">Polo Norte</text>

          {/* Brasil */}
          <circle cx={PONTOS_ROTA[4].x} cy={PONTOS_ROTA[4].y} r="5" fill="rgba(191, 165, 119, 0.2)" />
          <circle cx={PONTOS_ROTA[4].x} cy={PONTOS_ROTA[4].y} r="2.4" fill="#607568" stroke="#bfa577" strokeWidth="0.9" />
          <text x={PONTOS_ROTA[4].x - 6} y={PONTOS_ROTA[4].y + 3} fill="#bfa577" fontSize="9" fontWeight="800" textAnchor="end">Brasil</text>

          {/* Trenó com renas */}
          <g className={styles.noelTreno} transform={`translate(${pos.x}, ${pos.y})`}>
            <circle r="12" fill="rgba(197, 41, 45, 0.28)" />
            <g transform="translate(0 -2) scale(0.95)">
              {/* renas (voltadas para a esquerda) */}
              <g stroke="#bfa577" strokeWidth="0.9" strokeLinecap="round" fill="none">
                <path d="M -19 -3 L -9 -3" />
                <path d="M -21 -6 L -23 -9 M -22 -7.5 L -24.5 -7 M -20 -6 L -19 -9.5" />
              </g>
              <ellipse cx="-13" cy="-1" rx="5.2" ry="2.8" fill="#bfa577" />
              <circle cx="-18.6" cy="-4" r="2" fill="#bfa577" />
              <circle cx="-20.4" cy="-3.7" r="0.8" fill="#c5292d" />
              <path d="M -15 1 L -15.6 5 M -11 1 L -10.4 5" stroke="#bfa577" strokeWidth="0.9" strokeLinecap="round" />
              {/* trenó */}
              <path d="M -6 -2 L 12 -2 Q 14 -2 13.6 1 L 12 5 L -4 5 Q -7 3 -6 -2 Z" fill="#c5292d" stroke="#f3ebdc" strokeWidth="0.7" />
              <path d="M -8 7 Q -8 6 -6 6 L 15 6 Q 17.5 6 17 3.5" fill="none" stroke="#bfa577" strokeWidth="1.1" strokeLinecap="round" />
              <circle cx="3" cy="-4.5" r="2.4" fill="#f3ebdc" />
              <path d="M 0.8 -5.4 Q 3 -9.6 6.4 -6.6 L 5.2 -4.6 Z" fill="#c5292d" />
              <circle cx="6.8" cy="-6.3" r="0.9" fill="#f3ebdc" />
              <rect x="7" y="-3" width="4.2" height="3.4" rx="0.6" fill="#607568" stroke="#f3ebdc" strokeWidth="0.4" />
            </g>
          </g>
        </svg>
      </div>

      <p className={styles.noelContador}>
        Presentes entregues: <strong>{milhoes} milhões</strong>
      </p>
    </div>
  );
}

export default PapaiNoelCena;
