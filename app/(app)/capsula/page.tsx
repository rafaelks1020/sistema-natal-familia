import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import { carregarCapsula } from '@/app/api/capsula/_data';
import CapsulaClient from './_client';

export default async function CapsulaPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  return <CapsulaClient initial={await carregarCapsula(me)} />;
}
