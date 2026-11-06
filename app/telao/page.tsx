import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import { getEstado } from '@/app/api/telao/estado/_data';
import { ToastProvider } from '@/app/ui/toast';
import ScreenClient from './_client';
export const dynamic = 'force-dynamic';
export default async function ScreenPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  const initial = await getEstado(me, new Set(['fotos', 'recados', 'advento', 'ceia', 'linha', 'nomes']));
  return <ToastProvider><ScreenClient initial={initial} /></ToastProvider>;
}
