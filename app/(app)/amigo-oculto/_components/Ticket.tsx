'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import LoopMedia from '@/app/ui/LoopMedia';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { diaLongo } from './format';
import type { Receiver, SantaConfig } from './types';

function SealMark() {
  return (
    <svg viewBox="0 0 64 64" className="h-11 w-11 text-champagne" fill="none" aria-hidden>
      <circle cx="32" cy="32" r="22" stroke="currentColor" strokeWidth="1" />
      <path d="M32 16 L34.2 27.2 L45 32 L34.2 36.8 L32 48 L29.8 36.8 L19 32 L29.8 27.2 Z" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function SealBreak({ onDone }: { onDone: () => void }) {
  const cb = useRef(onDone);
  useEffect(() => {
    cb.current = onDone;
  });
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = window.setTimeout(() => cb.current(), reduce ? 180 : 1100);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <style>{`
        @keyframes ao-seal-l { to { transform: translate(-30px, 18px) rotate(-22deg); opacity: 0; } }
        @keyframes ao-seal-r { to { transform: translate(30px, 18px) rotate(22deg); opacity: 0; } }
        @keyframes ao-glow { 0% { opacity: 0; transform: scale(0.45); } 40% { opacity: 0.85; transform: scale(1); } 100% { opacity: 0; transform: scale(1.7); } }
        .ao-seal-l { animation: ao-seal-l 1.05s var(--ease-cine) forwards; }
        .ao-seal-r { animation: ao-seal-r 1.05s var(--ease-cine) forwards; }
        .ao-glow { animation: ao-glow 1.05s var(--ease-cine) forwards; }
      `}</style>
      <div className="relative h-28 w-28">
        <span className="ao-glow absolute inset-[-18px] rounded-full bg-champagne/25 blur-md" />
        <span className="ao-seal-l absolute inset-y-0 left-0 w-1/2 overflow-hidden">
          <span className="absolute left-0 top-0 flex h-28 w-28 items-center justify-center rounded-full border border-champagne bg-carvao-3">
            <SealMark />
          </span>
        </span>
        <span className="ao-seal-r absolute inset-y-0 right-0 w-1/2 overflow-hidden">
          <span className="absolute right-0 top-0 h-28 w-28 rounded-full border border-champagne bg-carvao-3" />
        </span>
      </div>
      <p className="kicker mt-8">Abrindo</p>
    </div>
  );
}

export default function Ticket({
  config,
  onDone,
}: {
  config: SantaConfig;
  onDone: (receiver: Receiver) => void;
}) {
  const toast = useToast();
  const [phase, setPhase] = useState<'sealed' | 'show'>('sealed');
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [glide, setGlide] = useState(true);
  const posRef = useRef({ x: 0, y: 0 });
  const drag = useRef({ x: 0, y: 0, active: false });
  const starting = useRef(false);
  const cancelled = useRef(false);
  const finished = useRef(false);
  const animRef = useRef(false);
  const receiverRef = useRef<Receiver | null>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  function tryFinish() {
    if (cancelled.current || finished.current) return;
    if (!animRef.current || !receiverRef.current) return;
    finished.current = true;
    onDoneRef.current(receiverRef.current);
  }

  const onAnimRef = useRef<() => void>(() => {});
  function onAnim() {
    if (cancelled.current) return;
    animRef.current = true;
    tryFinish();
  }
  useEffect(() => {
    onAnimRef.current = onAnim;
  });

  useEffect(() => {
    if (phase !== 'show') return;
    const t = window.setTimeout(() => onAnimRef.current(), 7000);
    return () => window.clearTimeout(t);
  }, [phase]);

  async function start() {
    if (starting.current || phase !== 'sealed') return;
    starting.current = true;
    cancelled.current = false;
    animRef.current = false;
    receiverRef.current = null;
    setPhase('show');
    try {
      const data = await api<{ receiver: Receiver }>('/api/secret-santa/reveal', { method: 'POST' });
      if (cancelled.current) return;
      receiverRef.current = data.receiver;
      tryFinish();
    } catch (err) {
      cancelled.current = true;
      starting.current = false;
      finished.current = false;
      posRef.current = { x: 0, y: 0 };
      setPos({ x: 0, y: 0 });
      setGlide(true);
      setPhase('sealed');
      toast((err as Error).message, 'erro');
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (phase !== 'sealed') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, active: true };
    setGlide(false);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current.active) return;
    const next = {
      x: (e.clientX - drag.current.x) * 0.92,
      y: (e.clientY - drag.current.y) * 0.92,
    };
    posRef.current = next;
    setPos(next);
  }

  function onPointerUp() {
    if (!drag.current.active) return;
    drag.current.active = false;
    const dist = Math.hypot(posRef.current.x, posRef.current.y);
    if (dist > 100) {
      void start();
      return;
    }
    setGlide(true);
    posRef.current = { x: 0, y: 0 };
    setPos({ x: 0, y: 0 });
  }

  const dist = Math.hypot(pos.x, pos.y);
  const when = diaLongo(config.reveal_date);
  const texture = {
    backgroundImage: `
      radial-gradient(ellipse at 50% 38%, rgba(191,165,119,0.16), transparent 58%),
      repeating-linear-gradient(-16deg, transparent, transparent 11px, rgba(243,235,220,0.03) 11px, rgba(243,235,220,0.03) 12px)
    `,
  };

  return (
    <section
      className="rise relative min-h-[460px] overflow-hidden rounded-[18px] border border-linha-forte bg-carvao-2"
      style={texture}
    >
      <span className="pointer-events-none absolute inset-2 rounded-[14px] border border-champagne/25" />
      <span className="absolute left-0 top-[62%] h-8 w-4 -translate-x-1/2 rounded-r-full bg-carvao" />
      <span className="absolute right-0 top-[62%] h-8 w-4 translate-x-1/2 rounded-l-full bg-carvao" />

      {phase === 'show' ? (
        <div className="absolute inset-0 bg-carvao">
          <LoopMedia
            name="mn-revelacao"
            once
            onEnded={onAnim}
            className="h-full w-full"
            fallback={<SealBreak onDone={onAnim} />}
          />
        </div>
      ) : (
        <div className="relative flex min-h-[460px] flex-col px-6 pb-6 pt-8">
          <p className="kicker text-center">Ingresso</p>
          <p className="display mt-2 text-center text-[1.7rem]">Amigo oculto</p>

          <div className="flex flex-1 flex-col items-center justify-center py-6">
            <div
              role="button"
              tabIndex={0}
              aria-label="Arraste o selo para revelar"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void start();
                }
              }}
              className="flex h-28 w-28 cursor-grab touch-none items-center justify-center rounded-full border border-champagne bg-champagne/10 active:cursor-grabbing focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-champagne"
              style={{
                transform: `translate(${pos.x}px, ${pos.y}px) rotate(${pos.x * 0.06}deg)`,
                transition: glide ? 'transform 0.6s var(--ease-cine)' : 'none',
              }}
            >
              <SealMark />
            </div>
            <p className="mt-5 text-sm text-marfim-2">
              {dist > 72 ? 'Solte para revelar' : 'Arraste para revelar'}
            </p>
          </div>

          <div className="border-t border-dashed border-champagne/35 pt-4 text-center">
            <p className="kicker">Natal em família</p>
            {when && <p className="mt-2 text-sm text-marfim-2">Data combinada: {when}</p>}
            <button type="button" className="btn btn-ghost mt-4 w-full" onClick={() => void start()}>
              Revelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
