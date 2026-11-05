import { requireUser } from '@/app/lib/api';
import { getContas } from '@/app/api/contas-da-ceia/_data';
import ContasClient from './_client';
export default async function ContasPage() {
  const me = await requireUser();
  return <ContasClient initial={await getContas(me.id, me.is_admin)} me={{ id: me.id, is_admin: me.is_admin }} />;
}
