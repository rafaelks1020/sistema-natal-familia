import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import { getChallenges } from '@/app/api/festa/desafio/data';
import FestaClient from './_client';
export default async function FestaPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  return <FestaClient initial={await getChallenges(me)} />;
}
