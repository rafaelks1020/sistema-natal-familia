import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import LembretesClient from './_client';

export default async function LembretesPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  if (!me.is_admin) redirect('/');
  return <LembretesClient />;
}
