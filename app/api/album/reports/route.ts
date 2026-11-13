import { enviarPush } from '@/app/lib/push';
import { cleanText, HttpError, ok, requireAdmin, requireUser, route, toInt } from '@/app/lib/api';
import { query, transaction } from '@/app/lib/db';
import { findPhoto, readAlbumJson } from '../data';
export const POST = route(async req => {
  const me = await requireUser(); const body = await readAlbumJson(req); const photo = await findPhoto(me, body.key);
  if (photo.source !== 'album') throw new HttpError(400, 'Denuncie esta foto na publicação original.');
  const motivo = cleanText(body.motivo, 'motivo', 1000);
  const nova = await transaction(async (q) => {
    await q('SELECT id FROM album_photos WHERE id = $1 FOR UPDATE', [photo.id]);
    const aberta = await q(
      'SELECT id FROM album_photo_reports WHERE user_id = $1 AND photo_id = $2 AND resolved_at IS NULL LIMIT 1',
      [me.id, photo.id],
    );
    if (aberta.rows.length) return false;
    await q('INSERT INTO album_photo_reports(ano, photo_id, user_id, motivo) VALUES($1,$2,$3,$4)', [photo.ano, photo.id, me.id, motivo]);
    await q(`INSERT INTO family_notifications (user_id, actor_id, type)
      SELECT id, $1, 'report' FROM family_users WHERE is_admin`, [me.id]);
    return true;
  });
  if (nova) {
    const { rows: admins } = await query<{ id: number }>('SELECT id FROM family_users WHERE is_admin');
    void enviarPush(admins.map((a) => a.id), { titulo: 'Nova denúncia', corpo: 'Foto do álbum denunciada para análise.', rota: '/album' });
  }
  return ok({ ok: true }, nova ? 201 : 200);
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
