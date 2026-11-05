import { HttpError, ok, requireUser, route } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { findPhoto, readAlbumJson } from '../data';
export const PUT = route(async req => {
  const me = await requireUser(); const body = await readAlbumJson(req); const photo = await findPhoto(me, body.key);
  if (photo.source !== 'album' || typeof body.liked !== 'boolean') throw new HttpError(400, 'Curta as fotos do mural na publicação original.');
  if (body.liked) await query(`INSERT INTO album_photo_likes(ano, photo_id, user_id) VALUES($1,$2,$3)
    ON CONFLICT(photo_id, user_id) DO NOTHING`, [photo.ano, photo.id, me.id]);
  else await query('DELETE FROM album_photo_likes WHERE photo_id = $1 AND user_id = $2', [photo.id, me.id]);
  return ok({ ok: true });
});
