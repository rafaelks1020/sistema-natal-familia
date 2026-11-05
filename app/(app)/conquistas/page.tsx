import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import { carregarConquistas } from '@/app/lib/conquistas';
import ConquistasClient from './_client';

export default async function ConquistasPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  return <ConquistasClient initial={await carregarConquistas(me.id)} />;
}
