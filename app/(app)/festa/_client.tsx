'use client';
import PageHeader from '@/app/ui/PageHeader';
import LoopMedia from '@/app/ui/LoopMedia';
import Atalhos from '@/app/ui/Atalhos';
import { useMe } from '@/app/ui/user';
import { Camera, Dices, Gamepad2, Gift, MicVocal, Radio, Trophy, Tv, Users, Vote } from 'lucide-react';
import type { ChallengeData } from '@/app/api/festa/desafio/data';

const ORGANIZA = [
  { href: '/telao', titulo: 'Telão para a TV', texto: 'Abra no navegador da TV e entre com sua conta.', icon: Tv },
  { href: '/telao/controle', titulo: 'Controle do telão', texto: 'Quem organiza troca o que aparece na TV.', icon: Tv },
];

export default function FestaClient({ initial }: { initial: ChallengeData }) {
  const me = useMe();
  const aberto = initial.desafios.find((c) => c.aberto);
  const noite = [
    { href: '/karaoke', titulo: 'Karaokê', texto: 'Cante com a letra na TV', icon: MicVocal },
    { href: '/amigo-oculto/ao-vivo', titulo: 'Revelação do amigo oculto', texto: 'Acompanhe cada surpresa da noite.', icon: Gift },
    { href: '/ao-vivo', titulo: 'Mandar recado para a TV', texto: 'Sua mensagem aparece na TV da sala.', icon: Radio },
    { href: '/festa/jogos-novos', titulo: 'Jogos da noite', texto: 'Mímica, quem é o bebê, roleta de prendas e batalha de times.', icon: Gamepad2 },
    { href: '/festa/quiz', titulo: 'Quiz da família', texto: 'Quem conhece melhor a nossa história?', icon: Trophy },
    { href: '/festa/bingo', titulo: 'Bingo da ceia', texto: 'Prepare sua cartela e venha brincar.', icon: Dices },
    { href: '/festa/enquete', titulo: 'Enquete', texto: 'A família escolhe, o resultado aparece na hora.', icon: Vote },
    { href: '/festa/desafio', titulo: 'Desafio de foto', texto: aberto ? `Aberto: ${aberto.titulo}` : 'Uma foto, muitos sorrisos. Participe e vote.', icon: Camera },
    { href: '/festa/foto-oficial', titulo: 'Foto oficial do ano', texto: 'Mesma pose todo ano. Vamos guardar este encontro.', icon: Users },
  ];
  return <>
    <PageHeader kicker={`Natal ${initial.ano}`} title="A noite da ceia" />
    <div className="space-y-8 px-5 pb-8">
      <div className="relative overflow-hidden rounded-2xl border border-linha bg-carvao-2 p-6"><LoopMedia name="mn-ceia" className="mb-4 h-32 w-full rounded-xl" /><p className="kicker mb-2">Todo mundo junto</p><p className="display text-3xl">A festa é nossa.</p><p className="mt-2 text-sm text-marfim-2">Fotos, brincadeiras e as lembranças que ficam.</p></div>
      <Atalhos titulo="Na noite de Natal" itens={noite} />
      {me.is_admin ? <Atalhos titulo="Para quem organiza" itens={ORGANIZA} /> : null}
    </div>
  </>;
}
