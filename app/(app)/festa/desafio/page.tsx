import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import { getChallenges } from '@/app/api/festa/desafio/data';
import ChallengeClient from './_client';
export default async function ChallengePage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  return <ChallengeClient initial={await getChallenges(me)} />;
}
