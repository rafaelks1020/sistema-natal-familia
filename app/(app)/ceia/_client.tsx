'use client';

import { useState } from 'react';
import { CalendarDays, Car, Gift, UserPlus, Wallet } from 'lucide-react';
import type { CeiaDados } from '@/app/api/ceia/tipos';
import Atalhos from '@/app/ui/Atalhos';
import { EventoCeia } from './_evento';
import { PratosCeia } from './_pratos';
import { PresencaCeia } from './_presenca';
import { VotacaoCeia } from './_votacao';

const ATALHOS = [
  { href: '/vaquinha', titulo: 'Dinheiro da ceia', texto: 'Vaquinha, contas e Pix', icon: Wallet },
  { href: '/amigo-oculto', titulo: 'Amigo oculto', texto: 'Veja quem você tirou e a lista de desejos', icon: Gift },
  { href: '/caronas', titulo: 'Caronas e hospedagem', texto: 'Quem dá carona e quem tem quarto sobrando', icon: Car },
  { href: '/advento', titulo: 'Calendário do Advento', texto: 'Uma surpresa por dia até o Natal', icon: CalendarDays },
  { href: '/convidar', titulo: 'Convidar parente', texto: 'Chamou gente nova? Peça o convite aqui', icon: UserPlus },
];

export default function CeiaClient({ inicial }: { inicial: CeiaDados }) {
  const [dados, setDados] = useState(inicial);
  return (
    <div className="min-w-0 space-y-10 overflow-x-hidden px-5 pb-16">
      <EventoCeia evento={dados.evento} onEvento={(evento) => setDados((atual) => ({ ...atual, evento }))} />
      <div className="rule" />
      <Atalhos itens={ATALHOS} />
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
