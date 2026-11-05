import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import { carregarHomenagem } from '@/app/api/homenagem/_data';
import HomenagemClient from './_client';

export default async function HomenagemPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  return <HomenagemClient initial={await carregarHomenagem(me)} />;
}
