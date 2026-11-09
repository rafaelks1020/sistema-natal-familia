'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Flame, LogOut, Settings2, Shield, SlidersHorizontal, Sparkles, Trophy, Tv } from 'lucide-react';
import AtivarNotificacoes from '@/app/components/AtivarNotificacoes';
import CartaoGamificacao from '../_inicio/CartaoGamificacao';
import Avatar from '@/app/ui/Avatar';
import { api } from '@/app/ui/client';
import LetraMaior from '@/app/ui/LetraMaior';
import PageHeader from '@/app/ui/PageHeader';
import { useToast } from '@/app/ui/toast';
import { useMe } from '@/app/ui/user';

const ATALHOS = [
  { href: '/pontos', titulo: 'Meus pontos e ranking', texto: 'Sua posição, o extrato e os brindes', icon: Trophy },
  { href: '/conquistas', titulo: 'Minhas conquistas', texto: 'Os selos que você já ganhou', icon: Sparkles },
  { href: '/missoes', titulo: 'Missões relâmpago', texto: 'Desafios surpresa valendo pontos', icon: Flame },
] as const;

const ORGANIZAR = [
  { href: '/organizar', titulo: 'Organizar o Natal', texto: 'Datas, lista e o que a noite precisa', icon: Settings2 },
  { href: '/telao', titulo: 'Telão na TV', texto: 'O que a televisão da festa mostra', icon: Tv },
  { href: '/telao/controle', titulo: 'Controle do telão', texto: 'Troque a tela da TV na hora', icon: SlidersHorizontal },
  { href: '/admin', titulo: 'Painel de administração', texto: 'Pessoas, convites e ajustes', icon: Shield },
] as const;

function ListaAtalhos({ itens }: { itens: readonly { href: string; titulo: string; texto: string; icon: typeof Trophy }[] }) {
  return (
    <ul className="divide-y divide-linha border-y border-linha">
      {itens.map(({ href, titulo, texto, icon: Icone }) => (
        <li key={href}>
          <Link href={href} className="flex min-h-16 items-center gap-4 py-4 focus-visible:outline-2 focus-visible:outline-champagne">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-champagne/40 text-champagne">
              <Icone size={22} strokeWidth={1.5} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="display block text-xl leading-tight">{titulo}</span>
              <span className="mt-1 block text-sm text-marfim-2">{texto}</span>
            </span>
            <ArrowUpRight size={18} strokeWidth={1.5} className="shrink-0 text-champagne" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function ContaClient() {
  const me = useMe();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await api('/api/auth', { method: 'DELETE' });
      window.location.href = '/entrar';
    } catch (error) {
      toast((error as Error).message, 'erro');
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader kicker="Sua área" title="Eu" />
      <div className="space-y-8 px-5 pb-8">
        <section className="surface p-5">
          <div className="flex items-center gap-4">
            <Avatar name={me.name} src={me.avatar_url} size={96} ring />
            <h2 className="display min-w-0 break-words text-3xl leading-tight">{me.name}</h2>
          </div>
          <Link href={`/familia/${me.id}`} className="btn btn-ghost mt-4 w-full">Editar meu perfil e foto</Link>
        </section>

        <CartaoGamificacao />
        <ListaAtalhos itens={ATALHOS} />

        <section aria-labelledby="eu-avisos" className="space-y-3">
          <h2 id="eu-avisos" className="display text-3xl">Avisos</h2>
          <AtivarNotificacoes modo="fixo" />
        </section>

        <section aria-labelledby="eu-leitura" className="surface space-y-3 p-5">
          <h2 id="eu-leitura" className="display text-3xl">Leitura</h2>
          <p className="text-sm text-marfim-2">Deixa as letras do site maiores</p>
          <LetraMaior />
        </section>

        {me.is_admin && (
          <section aria-labelledby="eu-organizar" className="space-y-3">
            <h2 id="eu-organizar" className="display text-3xl">Organizar</h2>
            <ListaAtalhos itens={ORGANIZAR} />
          </section>
        )}

        <footer className="space-y-4 border-t border-linha pt-6">
          <button type="button" className="btn btn-ghost w-full" disabled={busy} onClick={() => { void logout(); }}>
            <LogOut size={18} strokeWidth={1.5} />
            {busy ? 'Saindo...' : 'Sair'}
          </button>
          <div className="flex flex-col">
            <Link href="/termos" className="flex min-h-12 items-center text-sm text-marfim-2 underline underline-offset-4">Termos de uso</Link>
            <Link href="/privacidade" className="flex min-h-12 items-center text-sm text-marfim-2 underline underline-offset-4">Privacidade</Link>
            <Link href="/conta/excluir" className="flex min-h-12 items-center text-sm text-cereja underline underline-offset-4">Excluir minha conta</Link>
          </div>
        </footer>
      </div>
    </>
  );
}
