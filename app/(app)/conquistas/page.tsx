import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import ConquistasClient from './_client';

export const metadata: Metadata = { title: 'Conquistas · Natal em Família' };
export const dynamic = 'force-dynamic';

export default async function ConquistasPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  return <ConquistasClient />;
}
