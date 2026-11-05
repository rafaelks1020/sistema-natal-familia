import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import { getTimeline } from '@/app/api/memorias/data';
import MemoriesClient from '../_client';
export default async function TimelinePage() {
  const me = await getSessionUser(); if (!me) redirect('/entrar');
  return <MemoriesClient today={[]} editions={await getTimeline(me)} timeline />;
}
