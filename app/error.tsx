'use client';

import { RotateCcw } from 'lucide-react';

export default function ErroGeral({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="rise mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center bg-carvao px-8 text-center">
      <p className="kicker">Ops</p>
      <h1 className="display mt-3 text-3xl text-marfim">Algo não deu certo</h1>
      <p className="mt-3 max-w-xs text-sm text-marfim-2">
        Não conseguimos abrir esta página agora. Confira a internet e tente de novo.
      </p>
      <button type="button" onClick={() => reset()} className="btn btn-primary mt-7 min-h-11">
        <RotateCcw size={18} strokeWidth={1.5} />
        Tentar de novo
      </button>
    </main>
  );
}
