import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import { carregarPedidos } from '@/app/lib/convites';
import PageHeader from '@/app/ui/PageHeader';
import PedidosConvite from './_client';

export default async function ConvidarPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  return <><PageHeader kicker="Cabe mais um" title="Convidar parente" back="/ceia" /><section className="px-5 pb-8"><PedidosConvite initial={await carregarPedidos({ id: me.id, is_admin: false })} /></section></>;
}
