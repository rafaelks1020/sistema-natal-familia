import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import NotificacoesClient from './_client';

export default async function NotificacoesPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  if (!me.is_admin) redirect('/');
  return <NotificacoesClient />;
}
