'use client';

import { RotateCcw } from 'lucide-react';

export default function ErroDaTela({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rise flex min-h-[70dvh] flex-col items-center justify-center px-8 text-center">
      <p className="kicker">Ops</p>
      <h1 className="display mt-3 text-3xl text-marfim">Algo não deu certo</h1>
      <p className="mt-3 max-w-xs text-sm text-marfim-2">
        Não conseguimos abrir esta tela agora. Confira a internet e tente de novo.
      </p>
      <button type="button" onClick={() => reset()} className="btn btn-primary mt-7 min-h-11">
        <RotateCcw size={18} strokeWidth={1.5} />
        Tentar de novo
      </button>
    </div>
  );
}
