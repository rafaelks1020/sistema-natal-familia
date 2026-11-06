import { cleanText, HttpError, ok, readJson, requireUser, route } from '@/app/lib/api';
import { mutatePlaylist } from '../_service';
import { parseMomento } from '../momentos';

export const POST = route(async req => {
  const me = await requireUser();
  const body = await readJson<Record<string, unknown>>(req);
  const momento = parseMomento(body?.momento);
  if (!momento) throw new HttpError(400, 'Escolha jantar, festa ou amigo oculto.');
  return ok(await mutatePlaylist(me, cleanText(body?.track_uri, 'a música', 80), false, momento));
});
