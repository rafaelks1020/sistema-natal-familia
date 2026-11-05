import { query } from '@/app/lib/db';
import { HttpError, ok, readJson, requireUser, route, toInt } from '@/app/lib/api';
import { parsePostImages, validateImagesInput } from '../_utils';

// PUT    /api/posts/[id] { content, images } (só autor)
// DELETE /api/posts/[id] (autor ou admin)

type ParamsCtx = { params: Promise<{ id: string }> };

export const PUT = route<ParamsCtx>(async (req, { params }) => {
  const me = await requireUser();
  const { id } = await params;
  const postId = toInt(id, 'id');

  const existing = await query<{
    id: number;
    user_id: number;
    image_url: string | null;
    image_urls: string | null;
  }>('SELECT id, user_id, image_url, image_urls FROM family_posts WHERE id = $1', [postId]);

  const current = existing.rows[0];
  if (!current) {
    throw new HttpError(404, 'Publicação não encontrada.');
  }
  if (Number(current.user_id) !== me.id) {
    throw new HttpError(403, 'Só quem publicou pode editar este post.');
  }

  const body = await readJson<Record<string, unknown>>(req);
  const images =
    body.images !== undefined
      ? validateImagesInput(body.images)
      : parsePostImages(current.image_urls, current.image_url);

  const rawContent = typeof body.content === 'string' ? body.content.trim() : '';
  if (!rawContent && images.length === 0) {
    throw new HttpError(400, 'Escreva uma mensagem ou mantenha pelo menos uma foto.');
  }
  if (rawContent.length > 2000) {
    throw new HttpError(400, 'O texto passou de 2000 caracteres.');
  }

  const imageUrl = images[0] ?? null;
  const imageUrlsJson = images.length > 0 ? JSON.stringify(images) : null;

  const { rows } = await query(
    `UPDATE family_posts
        SET content = $1,
            image_url = $2,
            image_urls = $3,
            updated_at = NOW()
      WHERE id = $4
      RETURNING id, user_id, content, image_url, image_urls, COALESCE(pinned, false) AS pinned, created_at, updated_at`,
    [rawContent, imageUrl, imageUrlsJson, postId],
  );

  const row = rows[0];
  return ok({
    id: Number(row.id),
    user_id: me.id,
    user_name: me.name,
    avatar_url: me.avatar_url,
    content: String(row.content ?? ''),
    images: parsePostImages(row.image_urls, row.image_url),
    pinned: Boolean(row.pinned),
    created_at: row.created_at,
    updated_at: row.updated_at ?? null,
  });
});

export const DELETE = route<ParamsCtx>(async (_req, { params }) => {
  const me = await requireUser();
  const { id } = await params;
  const postId = toInt(id, 'id');

  const existing = await query<{ id: number; user_id: number }>(
    'SELECT id, user_id FROM family_posts WHERE id = $1',
    [postId],
  );

  const current = existing.rows[0];
  if (!current) {
    throw new HttpError(404, 'Publicação não encontrada.');
  }
  if (Number(current.user_id) !== me.id && !me.is_admin) {
    throw new HttpError(403, 'Você não tem permissão para apagar esta publicação.');
  }

  await query('DELETE FROM family_posts WHERE id = $1', [postId]);
  return ok({ ok: true });
});
