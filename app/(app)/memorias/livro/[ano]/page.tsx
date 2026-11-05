import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import { albumYear, getAlbum } from '@/app/api/album/data';
import { getTimeline } from '@/app/api/memorias/data';
import PhotoBook from './_client';
export default async function BookPage({ params }: { params: Promise<{ ano: string }> }) {
  const me = await getSessionUser(); if (!me) redirect('/entrar'); const ano = albumYear((await params).ano);
  const [album, timeline] = await Promise.all([getAlbum(me, { ano, all: true }), getTimeline(me)]);
  return <PhotoBook ano={ano} photos={album.items.slice().reverse()} cover={timeline.find(e => e.ano === ano)?.cover ?? null} />;
}
