import { redirect } from 'next/navigation';
import { carregarCeia } from '@/app/api/ceia/dados';
import { getSessionUser } from '@/app/lib/session';
import PageHeader from '@/app/ui/PageHeader';
import CeiaClient from './_client';

export default async function CeiaPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  const inicial = await carregarCeia(me);
  return (
    <>
      <PageHeader kicker="A mesa da família" title="Ceia" back="/" />
      <CeiaClient inicial={inicial} />
    </>
  );
}
