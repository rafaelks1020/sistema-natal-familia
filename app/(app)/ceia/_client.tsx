'use client';

import { useState } from 'react';
import type { CeiaDados } from '@/app/api/ceia/tipos';
import { EventoCeia } from './_evento';
import { PratosCeia } from './_pratos';
import { PresencaCeia } from './_presenca';
import { VotacaoCeia } from './_votacao';

export default function CeiaClient({ inicial }: { inicial: CeiaDados }) {
  const [dados, setDados] = useState(inicial);
  return (
    <div className="min-w-0 space-y-10 overflow-x-hidden px-5 pb-16">
      <EventoCeia evento={dados.evento} onEvento={(evento) => setDados((atual) => ({ ...atual, evento }))} />
      <div className="rule" />
      <PresencaCeia presenca={dados.presenca} onPresenca={(presenca) => setDados((atual) => ({ ...atual, presenca }))} />
      <div className="rule" />
      <PratosCeia pratos={dados.pratos} onPratos={(pratos) => setDados((atual) => ({ ...atual, pratos }))} />
      <div className="rule" />
      <VotacaoCeia
        votacoes={dados.votacoes}
        onVotacoes={(votacoes) => setDados((atual) => ({ ...atual, votacoes }))}
        onEvento={(evento) => setDados((atual) => ({ ...atual, evento }))}
      />
    </div>
  );
}
