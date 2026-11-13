import LoopMedia from '@/app/ui/LoopMedia';

export default function Carregando() {
  return (
    <div role="status" aria-live="polite" className="fade-in flex min-h-[70dvh] flex-col items-center justify-center px-8 text-center">
      <LoopMedia
        name="mn-loader"
        className="h-14 w-14 rounded-full"
        fallback={<div className="h-10 w-10 animate-pulse rounded-full border border-champagne/60" />}
      />
      <p className="mt-4 text-sm text-marfim-2">Abrindo...</p>
    </div>
  );
}
