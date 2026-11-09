import { requireUser } from '@/app/lib/api';
import { loadLive } from '@/app/api/secret-santa/features';
import PageHeader from '@/app/ui/PageHeader';
import Client from './_client';
export const dynamic = 'force-dynamic';
export default async function AoVivoPage() {
  const me = await requireUser();
  const data = await loadLive();
  return <><PageHeader kicker="A noite da ceia" title="Revelação ao vivo" back="/festa" /><Client initial={JSON.parse(JSON.stringify(data))} isAdmin={me.is_admin} /></>;
}
