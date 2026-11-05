'use client';

import { useState } from 'react';
import { MEDIA_DISPONIVEL } from './media-manifest';

// Animações do ChatGPT convertidas para vídeo (bem mais leve que GIF no celular).
// Arquivos em /public/media/<name>.webm, .mp4 e .jpg (primeiro quadro, usado de pôster).
// Se o arquivo não existir, mostra o `fallback` e o layout não quebra.

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
  if (failed || !MEDIA_DISPONIVEL.has(name)) return <>{fallback}</>;
  return (
    <video
      className={`pointer-events-none select-none object-cover ${className}`}
      autoPlay
      muted
      playsInline
      loop={!once}
      preload="metadata"
      poster={`/media/${name}.jpg`}
      onEnded={onEnded}
      onError={() => setFailed(true)}
      aria-hidden
    >
      <source src={`/media/${name}.webm`} type="video/webm" onError={() => {}} />
      <source src={`/media/${name}.mp4`} type="video/mp4" onError={() => setFailed(true)} />
    </video>
  );
}
