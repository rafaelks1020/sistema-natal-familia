'use client';
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { Retrospective } from '@/app/api/memorias/types';
import { thumb } from '@/app/ui/thumb';
import { PhotoDialog } from '../../../album/_client';
const subscribe = (listener: () => void) => { const media = window.matchMedia('(prefers-reduced-motion: reduce)'); media.addEventListener('change', listener); return () => media.removeEventListener('change', listener); };
export default function Stories({ initial }: { initial: Retrospective }) {
  const router = useRouter();
  const [storedIndex, setIndex] = useState(0); const [paused, setPaused] = useState(false); const [options, setOptions] = useState(false);
  const reduced = useSyncExternalStore(subscribe, () => window.matchMedia('(prefers-reduced-motion: reduce)').matches, () => true);
  const last = initial.slides.length - 1; const index = Math.min(storedIndex, last); const slide = initial.slides[index];
  const advance = useCallback((delta: number) => { setIndex(i => Math.max(0, Math.min(last, i + delta))); setOptions(false); }, [last]);
  useEffect(() => { if (paused || reduced || options || index === last) return; const timer = setTimeout(() => advance(1), 6000); return () => clearTimeout(timer); }, [index, paused, reduced, options, last, advance]);
  useEffect(() => { const key = (e: KeyboardEvent) => { if (options || !['ArrowRight', 'ArrowLeft'].includes(e.key)) return; e.preventDefault(); advance(e.key === 'ArrowRight' ? 1 : -1); }; const visibility = () => setPaused(document.hidden);
    window.addEventListener('keydown', key); document.addEventListener('visibilitychange', visibility); return () => { window.removeEventListener('keydown', key); document.removeEventListener('visibilitychange', visibility); };
  }, [advance, options]);
  const photo = slide.photo; const url = photo?.url ?? slide.url;
  return <section className="fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-carvao text-marfim" aria-label={`Retrospectiva de ${initial.edition.ano}`}>
    <style>{'@keyframes memory-progress { from { transform:scaleX(0) } to { transform:scaleX(1) } }'}</style>
    <header className="relative z-10 space-y-3 px-4 pt-[calc(env(safe-area-inset-top)+16px)]"><div className="flex gap-1" aria-label={`Momento ${index + 1} de ${initial.slides.length}`}>{initial.slides.map((_, i) => <div key={i} className="h-1 min-w-0 flex-1 overflow-hidden rounded bg-marfim/20"><div key={`${index}:${i}:${paused}:${options}`} className="h-full origin-left bg-champagne" style={{ transform: `scaleX(${i < index || index === last ? 1 : 0})`, animation: i === index && index !== last && !reduced && !paused && !options ? 'memory-progress 6s linear forwards' : undefined }} /></div>)}</div>
      <div className="flex items-center justify-between"><p className="kicker">Nosso Natal · {initial.edition.ano}</p><div className="flex gap-2"><button className="btn btn-quiet" disabled={reduced} onClick={() => setPaused(p => !p)}>{reduced ? 'Manual' : paused ? 'Continuar' : 'Pausar'}</button><Link className="btn btn-quiet" href="/memorias">Fechar</Link></div></div>
    </header>
    <button className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-5 p-5 text-center" aria-label="Avançar para o próximo momento" onClick={() => advance(1)}>
      {url && <img key={url} src={thumb(url, 1280, 85)} alt={photo?.caption || slide.title} className="max-h-[52dvh] w-full rounded-xl object-contain" />}
      <h1 className="display text-balance text-4xl">{slide.title}</h1><p className="max-w-lg line-clamp-4 whitespace-pre-wrap break-words text-sm text-marfim-2">{slide.text}</p>
    </button>
    <footer className="space-y-3 px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">{photo && <button className="btn btn-quiet w-full" onClick={() => setOptions(true)}>Opções da foto e denúncia</button>}
      <div className="flex gap-3"><button className="btn btn-ghost flex-1" disabled={!index} onClick={() => advance(-1)}>Anterior</button>{index === last ? <Link className="btn btn-primary flex-1" href="/memorias">Voltar às memórias</Link> : <button className="btn btn-primary flex-1" onClick={() => advance(1)}>Próximo</button>}</div>
    </footer>
    {options && photo && <PhotoDialog photo={{ ...photo, can_edit: false }} people={[]} onClose={() => setOptions(false)} onUpdate={() => { setOptions(false); router.refresh(); }} onDelete={() => setOptions(false)} onNavigate={() => {}} />}
  </section>;
}
