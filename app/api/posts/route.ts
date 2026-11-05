import { query } from '@/app/lib/db';
import { HttpError, ok, readJson, requireUser, route } from '@/app/lib/api';
import { parsePostImages, validateImagesInput } from './_utils';
import { getFeed } from './data';

// GET  /api/posts?limit=20&before=<id>&user_id=<id>
// POST /api/posts { content, images?: string[] }

export const GET = route(async (req) => {
  const me = await requireUser();
  const { searchParams } = new URL(req.url);

  const limitParam = Number(searchParams.get('limit') || '20');
  const limit = Number.isInteger(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 20;

  const beforeParam = searchParams.get('before');
  const before = beforeParam ? Number(beforeParam) : null;
  if (before !== null && (!Number.isInteger(before) || before <= 0)) {
    throw new HttpError(400, 'Parâmetro before inválido.');
  }

  const userIdParam = searchParams.get('user_id');
  const filterUserId = userIdParam ? Number(userIdParam) : null;
  if (filterUserId !== null && (!Number.isInteger(filterUserId) || filterUserId <= 0)) {
    throw new HttpError(400, 'Parâmetro user_id inválido.');
  }

  return ok(await getFeed(me, { limit, before, userId: filterUserId }));
});

export const POST = route(async (req) => {
  const me = await requireUser();
  const body = await readJson<Record<string, unknown>>(req);

  const images = validateImagesInput(body.images);
  const rawContent = typeof body.content === 'string' ? body.content.trim() : '';

  if (!rawContent && images.length === 0) {
    throw new HttpError(400, 'Escreva uma mensagem ou escolha pelo menos uma foto.');
  }
  if (rawContent.length > 2000) {
    throw new HttpError(400, 'O texto passou de 2000 caracteres.');
  }

  const imageUrl = images[0] ?? null;
  const imageUrlsJson = images.length > 0 ? JSON.stringify(images) : null;

  const { rows } = await query(
    `INSERT INTO family_posts (user_id, content, image_url, image_urls, pinned)
     VALUES ($1, $2, $3, $4, false)
     RETURNING id, user_id, content, image_url, image_urls, pinned, created_at, updated_at`,
    [me.id, rawContent, imageUrl, imageUrlsJson],
  );

  const row = rows[0];
  return ok(
    {
      id: Number(row.id),
      user_id: me.id,
      user_name: me.name,
      avatar_url: me.avatar_url,
      content: String(row.content ?? ''),
      images: parsePostImages(row.image_urls, row.image_url),
      pinned: Boolean(row.pinned),
      created_at: row.created_at,
      updated_at: row.updated_at ?? null,
      reactions: {},
      my_reactions: [],
      comments: [],
      comments_count: 0,
    },
    201,
  );
});
