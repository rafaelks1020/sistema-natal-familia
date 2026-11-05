import { redirect } from 'next/navigation';
import { carregarCalendario } from '@/app/lib/advento';
import { getSessionUser } from '@/app/lib/session';
import AdventoClient from './_client';

export default async function AdventoPage() {
  const user = await getSessionUser();
  if (!user) redirect('/entrar');
  const initial = await carregarCalendario(user);
  return <AdventoClient initial={initial} />;
}
