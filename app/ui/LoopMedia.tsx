'use client';

import { useEffect, useRef, useState } from 'react';
import { MEDIA_DISPONIVEL } from './media-manifest';

// Animações do ChatGPT convertidas para vídeo (bem mais leve que GIF no celular).
// Arquivos em /public/media/<name>.webm, .mp4 e .jpg (primeiro quadro, usado de pôster).
// - Só toca o que está no manifesto (sem 404); senão mostra o `fallback`.
// - Fora da tela não baixa nem toca: economiza dados e bateria no celular.
// - Com "reduzir movimento" ligado no aparelho, fica parado no pôster.

interface Props {
  name: string;
  className?: string;
  fallback?: React.ReactNode;
  /** Sem loop: toca uma vez e para no último quadro (ex.: revelação). */
  once?: boolean;
  onEnded?: () => void;
}

export default function LoopMedia({ name, className = '', fallback = null, once = false, onEnded }: Props) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const disponivel = MEDIA_DISPONIVEL.has(name);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const calmo = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (calmo && !once) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          if (v.preload !== 'auto') {
            v.preload = 'auto';
            v.load();
          }
          v.play().catch(() => {});
        } else if (!once) {
          v.pause();
        }
      },
      { rootMargin: '120px' },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [once, disponivel]);

  if (failed || !disponivel) return <>{fallback}</>;
  return (
    <video
      ref={ref}
      className={`pointer-events-none select-none object-cover ${className}`}
      muted
      playsInline
      loop={!once}
      preload="none"
      poster={`/media/${name}.jpg`}
      onEnded={onEnded}
      onError={() => setFailed(true)}
      aria-hidden
    >
      <source src={`/media/${name}.webm`} type="video/webm" />
      <source src={`/media/${name}.mp4`} type="video/mp4" onError={() => setFailed(true)} />
    </video>
  );
}
