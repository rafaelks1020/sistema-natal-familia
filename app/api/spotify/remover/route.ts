import { cleanText, ok, readJson, requireUser, route } from '@/app/lib/api';
import { mutatePlaylist } from '../_service';

export const DELETE = route(async req => {
  const me = await requireUser();
  const body = await readJson<Record<string, unknown>>(req);
  return ok(await mutatePlaylist(me, cleanText(body?.track_uri, 'a música', 80), true));
});
