import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import ControleClient from './_client';
export const dynamic = 'force-dynamic';
export default async function ControlePage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  if (!me.is_admin) redirect('/');
  return <ControleClient />;
}
