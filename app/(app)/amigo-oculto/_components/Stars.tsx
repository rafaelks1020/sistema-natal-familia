'use client';

import { Star } from 'lucide-react';

const LABEL = ['seria legal', 'quero', 'quero muito'];

export default function Stars({ n, size = 13 }: { n: number; size?: number }) {
  const count = Math.min(3, Math.max(0, n));
  return (
    <span className="inline-flex gap-0.5 text-champagne" aria-label={`Prioridade ${count} de 3, ${LABEL[count - 1] ?? ''}`}>
      {[1, 2, 3].map((i) => (
        <Star
          key={i}
          size={size}
          strokeWidth={1.25}
          className={i <= count ? 'fill-champagne/80' : 'opacity-30'}
        />
      ))}
    </span>
  );
}
