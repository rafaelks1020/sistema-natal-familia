import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import AvisosClient from './_client';

export default async function AvisosPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  if (!me.is_admin) redirect('/');
  return <AvisosClient />;
}
