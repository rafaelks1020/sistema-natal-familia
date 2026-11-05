import { route, requireUser, requireAdmin, HttpError, readJson, cleanText, isBlobUrl, ok } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { getOfficialPhotos } from './data';
export const GET = route(async () => ok(await getOfficialPhotos(await requireUser())));
export const PUT = route(async (req) => {
  const me = await requireAdmin();
  const body = await readJson(req);
  if (!isBlobUrl(body?.image_url)) throw new HttpError(400, 'Envie a foto pelo aplicativo ou pelo site.');
  const legenda = cleanText(body.legenda, 'a legenda', 500, false);
  const dica = cleanText(body.dica_pose, 'a dica de pose', 500, false);
  await query(`INSERT INTO family_official_photos (ano, user_id, image_url, legenda, dica_pose) VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (ano) DO UPDATE SET user_id = EXCLUDED.user_id, image_url = EXCLUDED.image_url,
      legenda = EXCLUDED.legenda, dica_pose = EXCLUDED.dica_pose, created_at = NOW()`, [edicaoAtual(), me.id, body.image_url, legenda, dica]);
  return ok({ ok: true });
});
export const DELETE = route(async () => {
  await requireAdmin();
  await query('DELETE FROM family_official_photos WHERE ano = $1', [edicaoAtual()]);
  return ok({ ok: true });
});
