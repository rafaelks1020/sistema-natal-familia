import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import { carregarBingo } from '@/app/api/festa/bingo/_data';
import BingoClient from './_client';

export default async function FestaBingoPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  const initial = await carregarBingo(me);
  return <BingoClient initial={initial} />;
}
