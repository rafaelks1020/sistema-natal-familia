import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import { carregarArvore } from '@/app/api/arvore/_data';
import ArvoreClient from './_client';

export default async function ArvorePage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  return <ArvoreClient initial={await carregarArvore(me)} />;
}
