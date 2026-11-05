import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import { getOfficialPhotos } from '@/app/api/festa/foto-oficial/data';
import OfficialClient from './_client';
export default async function OfficialPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  return <OfficialClient initial={await getOfficialPhotos(me)} />;
}
