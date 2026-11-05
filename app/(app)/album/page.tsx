import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import { albumYear, getAlbum, getAlbumMetadata } from '@/app/api/album/data';
import { edicaoAtual } from '@/app/lib/edicao';
import AlbumClient from './_client';
export default async function AlbumPage({ searchParams }: { searchParams: Promise<{ ano?: string; pessoa?: string }> }) {
  const me = await getSessionUser(); if (!me) redirect('/entrar');
  const params = await searchParams;
  let ano = edicaoAtual();
  try { if (params.ano) ano = albumYear(params.ano); } catch { /* ano inválido na URL: fica na edição atual */ } const pessoa = params.pessoa ?? '';
  const [initial, metadata] = await Promise.all([getAlbum(me, { ano, pessoa }), getAlbumMetadata(me)]);
  return <AlbumClient key={`${ano}:${pessoa}`} initial={initial} metadata={metadata} ano={ano} pessoa={pessoa} />;
}
