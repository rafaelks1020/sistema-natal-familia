import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import { getOnThisDay, getTimeline } from '@/app/api/memorias/data';
import MemoriesClient from './_client';
export default async function MemoriesPage() {
  const me = await getSessionUser(); if (!me) redirect('/entrar');
  const [today, editions] = await Promise.all([getOnThisDay(me), getTimeline(me)]);
  return <MemoriesClient today={today} editions={editions} />;
}
