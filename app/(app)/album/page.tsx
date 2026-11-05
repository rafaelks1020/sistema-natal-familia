import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import { getAlbum } from '@/app/api/album/data';
import AlbumClient from './_client';

export default async function AlbumPage() {
  const user = await getSessionUser();
  if (!user) redirect('/entrar');
  const initial = await getAlbum(user);
  return <AlbumClient initial={initial} />;
}
