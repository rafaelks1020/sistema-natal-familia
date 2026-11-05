import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import { playlistData } from '@/app/api/spotify/_service';
import PlaylistClient from './_client';

export default async function PlaylistPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  let initial: Awaited<ReturnType<typeof playlistData>> | null = null;
  let error = '';
  try {
    initial = await playlistData(me);
  } catch {
    error = 'Não conseguimos carregar a playlist. Tente novamente ou reconecte o Spotify.';
  }
  return <PlaylistClient initial={initial} initialError={error} />;
}
