import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import MissoesClient from './_client';

export const metadata: Metadata = { title: 'Missões Relâmpago · Natal em Família' };
export const dynamic = 'force-dynamic';

export default async function MissoesPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  return <MissoesClient />;
}
