import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import { carregarConvites, carregarPedidos } from '@/app/lib/convites';
import { query } from '@/app/lib/db';
import ConvitesClient from './_client';

export default async function ConvitesPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  if (!me.is_admin) redirect('/convidar');
  const [initial, participantes, pedidos] = await Promise.all([
    carregarConvites(), query<{ id: number; name: string; user_id: number | null }>('SELECT id, name, user_id FROM participants ORDER BY name, id'), carregarPedidos(me),
  ]);
  return <ConvitesClient initial={initial} participants={participantes.rows} pedidos={pedidos} />;
}
