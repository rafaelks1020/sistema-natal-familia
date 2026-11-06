import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import EstatisticasClient from './_client';

export default async function EstatisticasPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  if (!me.is_admin) redirect('/');
  return <EstatisticasClient />;
}
