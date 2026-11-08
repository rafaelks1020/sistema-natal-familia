import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import PontosClient from './_client';

export const metadata: Metadata = { title: 'Pontos e Ranking · Natal em Família' };
export const dynamic = 'force-dynamic';

export default async function PontosPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  return <PontosClient />;
}
