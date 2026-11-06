import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import KaraokeTelao from './_client';

export const dynamic = 'force-dynamic';

// Tela do karaokê no notebook ligado na TV. Só quem organiza (admin) controla e grava notas.
export default async function KaraokeTelaoPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  return <KaraokeTelao admin={me.is_admin} />;
}
