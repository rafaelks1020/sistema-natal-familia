'use client';

import { Printer } from 'lucide-react';

export default function BotaoImprimir() {
  return (
    <button type="button" className="btn btn-primary w-full" onClick={() => window.print()}>
      <Printer size={18} strokeWidth={1.5} />
      Imprimir ou salvar em PDF
    </button>
  );
}
