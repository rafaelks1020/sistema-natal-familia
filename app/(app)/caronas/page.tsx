import { requireUser } from '@/app/lib/api';
import { getCaronas } from '@/app/api/caronas/_data';
import CaronasClient from './_client';

export default async function CaronasPage() {
  const me = await requireUser();
  return <CaronasClient initial={await getCaronas(me.id)} me={{ id: me.id, is_admin: me.is_admin }} />;
}
