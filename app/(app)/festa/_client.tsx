'use client';
import Link from 'next/link';
import PageHeader from '@/app/ui/PageHeader';
import LoopMedia from '@/app/ui/LoopMedia';
import type { ChallengeData } from '@/app/api/festa/desafio/data';
export default function FestaClient({ initial }: { initial: ChallengeData }) {
  const aberto = initial.desafios.find((c) => c.aberto);
  const links = [
    ['/festa/desafio', 'Desafio de foto', aberto ? `Aberto: ${aberto.titulo}` : 'Uma foto, muitos sorrisos. Participe e vote.'],
    ['/festa/foto-oficial', 'Foto oficial', 'Mesma pose todo ano. Vamos guardar este encontro.'],
    ['/festa/quiz', 'Quiz da família', 'Quem conhece melhor a nossa história?'],
    ['/festa/bingo', 'Bingo de Natal', 'Prepare sua cartela e venha brincar.'],
    ['/festa/enquete', 'Enquete ao vivo', 'A família escolhe, o resultado aparece na hora.'],
    ['/amigo-oculto/ao-vivo', 'Revelação do amigo oculto', 'Acompanhe cada surpresa da noite.'],
    ['/telao', 'Telão para a TV', 'Abra no navegador da TV e entre com sua conta.'],
  ];
  return <><PageHeader kicker={`Natal ${initial.ano}`} title="A noite da ceia" /><div className="space-y-5 px-5 pb-8">
    <div className="relative overflow-hidden rounded-2xl border border-linha bg-carvao-2 p-6"><LoopMedia name="mn-ceia" className="mb-4 h-32 w-full rounded-xl" /><p className="kicker mb-2">Todo mundo junto</p><p className="display text-3xl">A festa é nossa.</p><p className="mt-2 text-sm text-marfim-2">Fotos, brincadeiras e as lembranças que ficam.</p></div>
    <nav aria-label="Atividades da ceia" className="grid gap-3">{links.map(([href, title, text]) => <Link key={href} href={href} className="min-h-11 rounded-2xl border border-linha bg-carvao-2 p-5 transition-colors hover:border-champagne/50"><h2 className="display text-2xl">{title}</h2><p className="mt-2 text-sm text-marfim-2">{text}</p></Link>)}</nav>
  </div></>;
}
