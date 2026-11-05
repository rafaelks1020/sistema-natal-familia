import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import { getScreen } from '@/app/api/telao/data';
import { ToastProvider } from '@/app/ui/toast';
import ScreenClient from './_client';
export const dynamic = 'force-dynamic';
export default async function ScreenPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  return <ToastProvider><ScreenClient initial={await getScreen(me)} /></ToastProvider>;
}
