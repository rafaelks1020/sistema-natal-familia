import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import { carregarPainel } from '@/app/api/festa/jogos-novos/_data';
import type { JogosNovosPainel } from '@/app/api/festa/jogos-novos/_tipos';
import JogosNovosClient from './_client';

export default async function FestaJogosNovosPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  let initial: JogosNovosPainel | null = null;
  try {
    initial = await carregarPainel(me);
  } catch (e) {
    // Migração 034 ainda não aplicada: a página abre avisando em vez de quebrar.
    if ((e as { code?: string } | null)?.code !== '42P01') throw e;
  }
  return <JogosNovosClient initial={initial} />;
}
