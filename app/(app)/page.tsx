import { redirect } from 'next/navigation';
import { preload } from 'react-dom';
import { getSessionUser } from '@/app/lib/session';
import { getHome } from '@/app/api/home/data';
import InicioClient from './_client';

export default async function InicioPage() {
  // A capa é o maior elemento da tela: o navegador começa a baixar antes do JavaScript.
  preload('/media/mn-hero.jpg', { as: 'image', fetchPriority: 'high' });
  const user = await getSessionUser();
  if (!user) redirect('/entrar');
  const initial = await getHome(user);
  return <InicioClient initial={initial} />;
}
