import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import AoVivoClient from './_client';

export default async function AoVivoPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  return <AoVivoClient />;
}
