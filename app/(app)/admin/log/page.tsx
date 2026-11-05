import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import LogClient from './_client';

export default async function AdminLogPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  if (!me.is_admin) redirect('/');
  return <LogClient />;
}
