import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import AdminHome from './_client';

export default async function AdminPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  if (!me.is_admin) redirect('/');
  return <AdminHome />;
}
