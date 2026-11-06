import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowUpRight, BookOpen, Mail, CalendarDays, Camera, Car, Dices, Flame, Gift, Hourglass, Images, Mic, Music,
  PartyPopper, Receipt, Sparkles, TreePine, Trophy, Tv, UserPlus, Users, Utensils, Vote,
} from 'lucide-react';
import PageHeader from '@/app/ui/PageHeader';

export const metadata: Metadata = { title: 'Tudo do Natal · Natal em Família' };

type Item = { href: string; titulo: string; texto: string; icon: typeof Gift };
const GRUPOS: { titulo: string; itens: Item[] }[] = [
  { titulo: 'Antes da ceia', itens: [
    { href: '/ceia', titulo: 'A ceia', texto: 'Presença, quem leva o quê e votações', icon: Utensils },
    { href: '/advento', titulo: 'Calendário do Advento', texto: 'Uma surpresa por dia até o Natal', icon: CalendarDays },
    { href: '/caronas', titulo: 'Caronas e hospedagem', texto: 'Quem dá carona e quem tem quarto sobrando', icon: Car },
    { href: '/contas-da-ceia', titulo: 'Contas da ceia', texto: 'Quem pagou o quê e o acerto pelo Pix', icon: Receipt },
    { href: '/playlist', titulo: 'Playlist da família', texto: 'As músicas da noite no Spotify', icon: Music },
    { href: '/cartao', titulo: 'Cartão de Natal', texto: 'Sua foto num cartão para mandar no WhatsApp', icon: Mail },
    { href: '/convidar', titulo: 'Convidar parente', texto: 'Chamou gente nova? Peça o convite aqui', icon: UserPlus },
  ] },
  { titulo: 'Na noite de Natal', itens: [
    { href: '/festa', titulo: 'A festa', texto: 'Tudo da noite num lugar só', icon: PartyPopper },
    { href: '/amigo-oculto/ao-vivo', titulo: 'Revelação ao vivo', texto: 'O amigo oculto revelado na hora, no celular de todos', icon: Gift },
    { href: '/festa/desafio', titulo: 'Desafio de foto', texto: 'Melhor careta, melhor look e votação', icon: Camera },
    { href: '/festa/quiz', titulo: 'Quiz da família', texto: 'Quem disse isso? Que ano foi essa foto?', icon: Trophy },
    { href: '/festa/bingo', titulo: 'Bingo da ceia', texto: 'O tio contou a mesma piada? Marca!', icon: Dices },
    { href: '/festa/enquete', titulo: 'Enquete ao vivo', texto: 'Votação na hora, com resultado na tela', icon: Vote },
    { href: '/festa/foto-oficial', titulo: 'Foto oficial do ano', texto: 'A mesma pose, todo ano', icon: Users },
    { href: '/telao', titulo: 'Telão na TV', texto: 'Fotos, música, jogos e comando de voz na TV', icon: Tv },
    { href: '/telao/controle', titulo: 'Controle do telão', texto: 'Quem organiza troca o que aparece na TV', icon: Tv },
  ] },
  { titulo: 'Memórias da família', itens: [
    { href: '/memorias', titulo: 'Memórias', texto: 'Neste dia, linha do tempo, retrospectiva e livro de fotos', icon: Images },
    { href: '/receitas', titulo: 'Livro de receitas', texto: 'A receita da vó, com o segredo', icon: BookOpen },
    { href: '/historias', titulo: 'Histórias contadas', texto: 'Como era o Natal antigamente, em áudio', icon: Mic },
    { href: '/capsula', titulo: 'Cápsula do tempo', texto: 'Uma mensagem que só abre no próximo Natal', icon: Hourglass },
    { href: '/arvore', titulo: 'Árvore da família', texto: 'Quem é filho de quem, de geração em geração', icon: TreePine },
    { href: '/homenagem', titulo: 'Homenagem', texto: 'Lembranças de quem partiu', icon: Flame },
    { href: '/conquistas', titulo: 'Conquistas', texto: 'Selos e o ranking leve do ano', icon: Sparkles },
  ] },
];

export default function NatalPage() {
  return (
    <main className="pb-[calc(var(--nav-h)+40px)]">
      <PageHeader kicker="Natal em Família" title="Tudo do Natal" back="/" />
      <div className="space-y-10 px-5">
        {GRUPOS.map((g) => (
          <section key={g.titulo} aria-labelledby={`g-${g.titulo}`}>
            <h2 id={`g-${g.titulo}`} className="kicker mb-3">{g.titulo}</h2>
            <ul className="stagger divide-y divide-linha border-y border-linha">
              {g.itens.map(({ href, titulo, texto, icon: Icon }) => (
                <li key={href}>
                  <Link href={href} className="flex min-h-16 items-center gap-4 py-4 focus-visible:outline-2 focus-visible:outline-champagne">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-champagne/40 text-champagne">
                      <Icon size={20} strokeWidth={1.5} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="display block text-xl leading-tight">{titulo}</span>
                      <span className="mt-1 block text-xs text-marfim-3">{texto}</span>
                    </span>
                    <ArrowUpRight size={16} strokeWidth={1.5} className="shrink-0 text-champagne" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
