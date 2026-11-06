import { HttpError, ok, requireUser, route } from '@/app/lib/api';
import { playlistData } from './_service';
import { parseMomento } from './momentos';

export const GET = route(async req => {
  const me = await requireUser();
  const momento = parseMomento(new URL(req.url).searchParams.get('momento'));
  if (!momento) throw new HttpError(400, 'Escolha jantar, festa ou amigo oculto.');
  return ok(await playlistData(me, momento));
});
