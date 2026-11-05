import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import { edicaoAtual } from '@/app/lib/edicao';
import { carregar } from '@/app/api/receitas/_data';
import Client from './_client';
export default async function Page() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  return <Client items={await carregar(me.id)} ano={edicaoAtual()} />;
}
