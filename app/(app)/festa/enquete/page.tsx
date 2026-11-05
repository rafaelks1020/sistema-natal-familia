import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import { carregarEnquetes } from '@/app/api/festa/enquete/_data';
import EnqueteClient from './_client';

export default async function FestaEnquetePage({
  searchParams,
}: {
  searchParams: Promise<{ tv?: string }>;
}) {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  const [initial, params] = await Promise.all([carregarEnquetes(me), searchParams]);
  return <EnqueteClient initial={initial} initialTv={params?.tv === '1'} />;
}
