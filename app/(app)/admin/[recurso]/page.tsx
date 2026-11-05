import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import RecursoClient from './_client';

export default async function AdminRecursoPage({ params }: { params: Promise<{ recurso: string }> }) {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  if (!me.is_admin) redirect('/');
  const { recurso } = await params;
  return <RecursoClient recurso={recurso} />;
}
