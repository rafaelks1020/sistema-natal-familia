import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import { carregarVaquinha } from '@/app/api/vaquinha/_data';
import VaquinhaClient from './_client';

export default async function VaquinhaPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  return <VaquinhaClient initial={await carregarVaquinha()} />;
}
