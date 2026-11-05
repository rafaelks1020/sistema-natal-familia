import { HttpError, ok, requireUser, route } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { parsePostImages } from '../posts/_utils';

export interface AlbumItem {
  key: string;
  url: string;
  source: 'post' | 'compra';
  post_id?: number;
  author_name?: string;
  author_avatar?: string | null;
  caption: string;
  created_at: string;
}

interface AlbumRow {
  id: number;
  source: 'post' | 'compra';
  caption: string | null;
  image_url: string | null;
  image_urls: string | null;
  created_at: string;
  author_name: string | null;
  author_avatar: string | null;
}

type Cursor = { created_at: string; source: 'post' | 'compra'; id: number };

function decodeCursor(value: string): Cursor {
  try {
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Cursor;
    if (!cursor || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(cursor.created_at)
        || Number.isNaN(Date.parse(cursor.created_at + 'Z'))
        || new Date(cursor.created_at + 'Z').toISOString().slice(0, 19) !== cursor.created_at.slice(0, 19)
        || !['post', 'compra'].includes(cursor.source)
        || !Number.isSafeInteger(cursor.id) || cursor.id < 1) throw new Error();
    return cursor;
  } catch {
    throw new HttpError(400, 'Cursor do álbum inválido.');
  }
}

export const GET = route(async (req) => {
  await requireUser();
  const { searchParams } = new URL(req.url);
  const rawLimit = Number(searchParams.get('limit') || 40);
  if (!Number.isInteger(rawLimit) || rawLimit < 1) throw new HttpError(400, 'Limite inválido.');
  const limit = Math.min(rawLimit, 100);
  const rawCursor = searchParams.get('cursor');
  const cursor = rawCursor ? decodeCursor(rawCursor) : null;

  // Mantém a precisão de microssegundos do Postgres no cursor, sem passar por Date.
  const { rows } = await query<AlbumRow>(
    `SELECT id, source, caption, image_url, image_urls,
            to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.US') AS created_at,
            author_name, author_avatar
       FROM (
         SELECT p.id, 'post'::text AS source, p.content AS caption,
                p.image_url, p.image_urls, p.created_at,
                u.name AS author_name, u.avatar_url AS author_avatar
           FROM family_posts p JOIN family_users u ON u.id = p.user_id
         UNION ALL
         SELECT id, 'compra'::text, description, image_url, image_urls, created_at,
                NULL::text, NULL::text FROM purchases
       ) sources
      WHERE (NULLIF(image_url, '') IS NOT NULL
          OR (NULLIF(image_urls, '') IS NOT NULL AND image_urls <> '[]'))
        AND ($1::timestamp IS NULL OR (created_at, source COLLATE "C", id)
             < ($1::timestamp, $2::text COLLATE "C", $3::int))
      ORDER BY sources.created_at DESC, source COLLATE "C" DESC, id DESC
      LIMIT $4`,
    [cursor?.created_at ?? null, cursor?.source ?? null, cursor?.id ?? null, limit + 1],
  );

  const items: AlbumItem[] = [];
  let consumed = 0;
  let last: AlbumRow | undefined;
  // O limite de fotos é flexível: inclui sempre todas as fotos da última origem.
  for (const row of rows.slice(0, limit)) {
    const urls = parsePostImages(row.image_urls, row.image_url);
    urls.forEach((url, index) => items.push({
      key: `${row.source}-${row.id}-${index}`,
      url,
      source: row.source,
      ...(row.source === 'post' ? { post_id: row.id } : {}),
      author_name: row.author_name ?? undefined,
      author_avatar: row.author_avatar,
      caption: row.caption ?? '',
      created_at: row.created_at + 'Z',
    }));
    consumed++;
    last = row;
    if (items.length >= limit) break;
  }
  const nextCursor = last && consumed < rows.length
    ? Buffer.from(JSON.stringify({ created_at: last.created_at, source: last.source, id: last.id })).toString('base64url')
    : null;
  return ok({ items, nextCursor });
});
