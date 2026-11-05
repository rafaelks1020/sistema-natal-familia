import { HttpError, ok, requireUser, route } from '@/app/lib/api';
import { transaction } from '@/app/lib/db';
import { findPhoto, getPeople, readAlbumJson } from '../data';
export const PUT = route(async req => {
  const me = await requireUser(); const body = await readAlbumJson(req); const photo = await findPhoto(me, body.key);
  if (!me.is_admin && photo.user_id !== me.id) throw new HttpError(403, 'Só o autor ou quem organiza pode marcar as pessoas.');
  const people = await getPeople(me); const selected = body.people;
  if (!Array.isArray(selected) || selected.length > 100 || selected.some(p => typeof p !== 'string' || !people.some(person => `${person.source}:${person.id}` === p))) throw new HttpError(400, 'Confira as pessoas marcadas.');
  await transaction(async q => {
    await q('DELETE FROM album_tags WHERE photo_key = $1', [photo.key]);
    if (selected.length) await q(`INSERT INTO album_tags(ano, photo_key, user_id, person_source, person_id, image_url)
      SELECT $1, $2, $3, split_part(person, ':', 1), split_part(person, ':', 2)::int, $5 FROM unnest($4::text[]) AS person`,
    [photo.ano, photo.key, me.id, [...new Set(selected as string[])], photo.url]);
  });
  return ok({ ok: true });
});
