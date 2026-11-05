import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import { albumYear } from '@/app/api/album/data';
import { getRetrospective, retrospectiveAvailable } from '@/app/api/memorias/data';
import PageHeader from '@/app/ui/PageHeader';
import Stories from './_client';
export default async function RetrospectivePage({ params }: { params: Promise<{ ano: string }> }) {
  const me = await getSessionUser(); if (!me) redirect('/entrar'); const ano = albumYear((await params).ano);
  if (!retrospectiveAvailable(me, ano)) return <><PageHeader title={`Natal de ${ano}`} back="/memorias" /><p className="px-5 text-marfim-2">A retrospectiva estará disponível a partir de 25/12/{ano}.</p><Link className="btn btn-ghost m-5" href={`/album?ano=${ano}`}>Ver as fotos do ano</Link></>;
  return <Stories initial={await getRetrospective(me, ano)} />;
}
