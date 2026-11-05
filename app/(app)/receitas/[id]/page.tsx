import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import { edicaoAtual } from '@/app/lib/edicao';
import { carregar } from '@/app/api/receitas/_data';
import Client from '../_client';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const items = await carregar(me.id, id);
  if (!items.length) notFound();
  return <Client items={items} ano={edicaoAtual()} detail />;
}
