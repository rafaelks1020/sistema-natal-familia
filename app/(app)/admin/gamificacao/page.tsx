import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import AdminGamificacaoClient from './_client';

export const metadata: Metadata = { title: 'Gamificação · Painel Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminGamificacaoPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  if (!me.is_admin) redirect('/');
  return <AdminGamificacaoClient />;
}
