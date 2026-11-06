'use client';

import styles from './cenas.module.css';

export interface PapaiNoelCenaProps {
  agora: number;
}

interface EstadoRota {
  frase: string;
  progresso: number;
  milhoes: number;
  pos: { x: number; y: number };
}

const PONTOS_ROTA: { x: number; y: number }[] = [
  { x: 500, y: 55 },  // Polo Norte
  { x: 780, y: 155 }, // Ásia
  { x: 540, y: 165 }, // Europa
  { x: 525, y: 275 }, // África
  { x: 335, y: 325 }, // Brasil
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
    x: Math.round(a.x + (b.x - a.x) * frac),
    y: Math.round(a.y + (b.y - a.y) * frac),
  };
}

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
  const { frase, milhoes, pos } = calcularEstadoNoel(agora);

  return (
    <div className={`${styles.cena} ${styles.noelCena}`}>
      <p className={styles.kicker}>Rastreador do Polo Norte</p>
      <h2 className={styles.titulo}>{frase}</h2>

      <div className={styles.noelMapaBox}>
        <svg viewBox="0 0 1000 460" className={styles.noelSvg} aria-label="Mapa da viagem do Papai Noel">
          {/* Linhas de latitude e longitude sutis */}
          <g stroke="rgba(243, 235, 220, 0.07)" strokeWidth="1" fill="none">
            <line x1="0" y1="115" x2="1000" y2="115" />
            <line x1="0" y1="230" x2="1000" y2="230" />
            <line x1="0" y1="345" x2="1000" y2="345" />
            <line x1="250" y1="0" x2="250" y2="460" />
            <line x1="500" y1="0" x2="500" y2="460" />
            <line x1="750" y1="0" x2="750" y2="460" />
          </g>

          {/* Continentes estilizados em silhueta */}
          <g fill="#25322b" stroke="rgba(191, 165, 119, 0.35)" strokeWidth="2">
            {/* América do Norte */}
            <path d="M 110 85 L 250 75 L 285 145 L 235 215 L 175 210 L 125 155 Z" />
            {/* América do Sul (com destaque suave no Brasil) */}
            <path d="M 255 240 L 355 265 L 375 335 L 315 425 L 265 390 L 245 295 Z" />
            {/* Europa */}
            <path d="M 455 95 L 575 85 L 595 165 L 485 185 L 445 145 Z" />
            {/* África */}
            <path d="M 460 200 L 580 205 L 605 295 L 545 385 L 485 345 L 450 255 Z" />
            {/* Ásia */}
            <path d="M 595 85 L 865 95 L 895 215 L 765 265 L 635 225 L 595 155 Z" />
            {/* Oceania */}
            <path d="M 770 315 L 885 310 L 900 385 L 790 395 Z" />
          </g>

          {/* Trilha pontilhada da viagem */}
          <polyline
            points={PONTOS_ROTA.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#bfa577"
            strokeWidth="3"
            strokeDasharray="8 8"
            opacity="0.75"
          />

          {/* Marcador do Polo Norte */}
          <circle cx="500" cy="55" r="7" fill="#f3ebdc" />
          <text x="515" y="60" fill="#cfc6b6" fontSize="18" fontWeight="700">Polo Norte</text>

          {/* Marcador do Brasil */}
          <circle cx="335" cy="325" r="8" fill="#607568" stroke="#bfa577" strokeWidth="2.5" />
          <text x="350" y="332" fill="#bfa577" fontSize="19" fontWeight="800">Brasil</text>

          {/* Trenó do Papai Noel */}
          <g className={styles.noelTreno} transform={`translate(${pos.x}, ${pos.y})`}>
            <circle cx="0" cy="0" r="22" fill="rgba(197, 41, 45, 0.32)" />
            <circle cx="0" cy="0" r="13" fill="#c5292d" stroke="#f3ebdc" strokeWidth="2.5" />
            <path
              d="M -8 4 L 8 4 L 12 -2 L -6 -2 Z"
              fill="#bfa577"
            />
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
