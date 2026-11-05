'use client';

import LoopMedia from '@/app/ui/LoopMedia';

function GiftFallback() {
  return (
    <svg viewBox="0 0 200 180" className="h-full w-full" fill="none" aria-hidden>
      <g style={{ animation: 'glow 4.5s var(--ease-cine) infinite' }}>
        <circle cx="46" cy="36" r="2" fill="#bfa577" />
        <circle cx="156" cy="28" r="1.5" fill="#bfa577" />
        <circle cx="168" cy="78" r="2" fill="#c5292d" opacity="0.8" />
        <circle cx="34" cy="92" r="1.4" fill="#bfa577" />
      </g>
      <rect x="48" y="78" width="104" height="72" rx="4" stroke="#bfa577" strokeWidth="1.25" />
      <path d="M44 78 H156 V66 H44 Z" stroke="#bfa577" strokeWidth="1.25" />
      <path d="M100 66 V150" stroke="#c5292d" strokeWidth="1.25" />
      <path d="M48 104 H152" stroke="#c5292d" strokeWidth="1.25" />
      <path d="M100 66 C 78 66, 70 40, 86 40 C 98 40, 100 54, 100 66 C 100 54, 102 40, 114 40 C 130 40, 122 66, 100 66" stroke="#c5292d" strokeWidth="1.25" />
    </svg>
  );
}

export default function Waiting() {
  return (
    <section className="fade-in px-1 text-center">
      <div className="mx-auto h-56 w-full max-w-[260px]">
        <LoopMedia name="mn-presente" className="h-full w-full" fallback={<GiftFallback />} />
      </div>
      <h2 className="display-italic mt-2 text-[2.15rem] leading-[1.08]">
        O sorteio ainda não aconteceu
      </h2>
      <p className="mx-auto mt-4 max-w-xs text-sm leading-relaxed text-marfim-2">
        Quando quem organiza fizer o sorteio, o nome aparece aqui, só para você.
      </p>
    </section>
  );
}

export function NotInDraw({ linked }: { linked: boolean }) {
  return (
    <section className="surface fade-in px-6 py-9 text-center">
      <p className="kicker mb-3">{linked ? 'Sorteio ativo' : 'Família'}</p>
      <h2 className="display text-[1.9rem] leading-[1.05]">
        {linked ? 'Seu nome não entrou nesta rodada' : 'Sua conta ainda não está na família'}
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-marfim-2">
        {linked
          ? 'Se isso for um engano, fale com quem organiza. Sua lista de desejos continua aqui embaixo.'
          : 'Peça para quem organiza te incluir. Aí você entra no próximo sorteio.'}
      </p>
    </section>
  );
}
