import { cleanText, HttpError, isBlobUrl, ok, requireUser, route } from '@/app/lib/api';
import { transaction } from '@/app/lib/db';
import { albumYear, findPhoto, getAlbum, getAlbumMetadata, getPeople, readAlbumJson } from './data';
export type { AlbumItem } from './types';

export const GET = route(async (req) => {
  const me = await requireUser(); const params = new URL(req.url).searchParams;
  if (params.get('meta') === '1') return ok(await getAlbumMetadata(me));
  return ok(await getAlbum(me, { limit: Number(params.get('limit') || 40), cursor: params.get('cursor'),
    ano: params.has('ano') ? albumYear(params.get('ano')) : undefined, pessoa: params.get('pessoa') }));
});

export const POST = route(async req => {
  const me = await requireUser(); const body = await readAlbumJson(req); const ano = albumYear(body.ano);
  const caption = cleanText(body.caption, 'legenda', 500, false);
  const takenOn = cleanText(body.taken_on, 'data da foto', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(takenOn) || Number(takenOn.slice(0, 4)) !== ano
    || !Number.isFinite(Date.parse(takenOn)) || new Date(takenOn).toISOString().slice(0, 10) !== takenOn) throw new HttpError(400, 'Informe uma data válida dentro do ano escolhido.');
  if (!Array.isArray(body.photos) || body.photos.length < 1 || body.photos.length > 30) throw new HttpError(400, 'Escolha de 1 a 30 fotos.');
  const photos = body.photos.map((photo: unknown) => {
    if (!photo || typeof photo !== 'object') throw new HttpError(400, 'Foto inválida.');
    const p = photo as Record<string, unknown>;
    if (!isBlobUrl(p.url)) throw new HttpError(400, 'Envie a foto pelo botão de upload.');
    return { url: p.url, key: cleanText(p.client_key, 'identificador do envio', 100) };
  });
  const people = await getPeople(me);
  if (body.people !== undefined && !Array.isArray(body.people)) throw new HttpError(400, 'Confira as pessoas marcadas.');
  const selected = [...new Set(Array.isArray(body.people) ? body.people : [])];
  if (selected.length > 100 || selected.some(p => typeof p !== 'string' || !people.some(person => `${person.source}:${person.id}` === p))) throw new HttpError(400, 'Confira as pessoas marcadas.');
  const ids = await transaction(async q => {
    const ids: number[] = [];
    for (const photo of photos) {
      const { rows } = await q<{ id: number; ano: number; image_url: string }>(`INSERT INTO album_photos(ano, user_id, image_url, caption, taken_on, client_key)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id, client_key) DO UPDATE SET client_key = EXCLUDED.client_key RETURNING id, ano, image_url`,
      [ano, me.id, photo.url, caption, takenOn, photo.key]);
      if (rows[0].ano !== ano) throw new HttpError(409, 'Este envio já foi guardado em outra edição.');
      const id = rows[0].id; ids.push(id);
      if (selected.length) await q(`INSERT INTO album_tags(ano, photo_key, user_id, person_source, person_id, image_url)
        SELECT $1, $2, $3, split_part(person, ':', 1), split_part(person, ':', 2)::int, $5
        FROM unnest($4::text[]) AS person WHERE true ON CONFLICT(photo_key, person_source, person_id) DO NOTHING`,
      [ano, `album-${id}-0`, me.id, selected, rows[0].image_url]);
    }
    return ids;
  });
  return ok({ ids }, 201);
});

export const DELETE = route(async req => {
  const me = await requireUser(); const body = await readAlbumJson(req); const photo = await findPhoto(me, body.key, me.is_admin);
  if (photo.source !== 'album') throw new HttpError(400, 'Para apagar uma foto do mural, abra a publicação original.');
  if (!me.is_admin && photo.user_id !== me.id) throw new HttpError(403, 'Só o autor ou quem organiza pode apagar.');
  await transaction(async q => {
    await q('DELETE FROM album_tags WHERE photo_key = $1', [photo.key]);
    await q('DELETE FROM album_photos WHERE id = $1 AND (user_id = $2 OR $3)', [photo.id, me.id, me.is_admin]);
  });
  return ok({ ok: true });
});
