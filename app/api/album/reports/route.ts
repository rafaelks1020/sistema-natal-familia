import { cleanText, HttpError, ok, requireAdmin, requireUser, route, toInt } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { findPhoto, readAlbumJson } from '../data';
export const POST = route(async req => {
  const me = await requireUser(); const body = await readAlbumJson(req); const photo = await findPhoto(me, body.key);
  if (photo.source !== 'album') throw new HttpError(400, 'Denuncie esta foto na publicação original.');
  const motivo = cleanText(body.motivo, 'motivo', 1000);
  await query('INSERT INTO album_photo_reports(ano, photo_id, user_id, motivo) VALUES($1,$2,$3,$4)', [photo.ano, photo.id, me.id, motivo]);
  return ok({ ok: true }, 201);
});
export const GET = route(async () => {
  await requireAdmin();
  const { rows } = await query(`SELECT r.id, r.ano, r.motivo, p.image_url, p.caption,
    'album-' || p.id || '-0' AS key, u.name AS author_name FROM album_photo_reports r
    JOIN album_photos p ON p.id = r.photo_id JOIN family_users u ON u.id = p.user_id
    WHERE r.resolved_at IS NULL ORDER BY r.created_at LIMIT 100`);
  return ok({ reports: rows });
});
export const PATCH = route(async req => {
  await requireAdmin(); const body = await readAlbumJson(req);
  const id = toInt(body.id); if (id > 2147483647) throw new HttpError(400, 'Denúncia inválida.');
  await query('UPDATE album_photo_reports SET resolved_at = NOW() WHERE id = $1', [id]);
  return ok({ ok: true });
});
