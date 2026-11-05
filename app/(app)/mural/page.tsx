import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import { getFeed } from '@/app/api/posts/data';
import MuralClient from './_client';

export default async function MuralPage() {
  const user = await getSessionUser();
  if (!user) redirect('/entrar');
  const initial = await getFeed(user);
  return <MuralClient initial={initial} />;
}
