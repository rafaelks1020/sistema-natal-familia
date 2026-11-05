import { HttpError, ok, requireUser, route } from '@/app/lib/api';
import { query } from '@/app/lib/db';

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

interface PostRow {
  id: number;
  content: string | null;
  image_url: string | null;
  image_urls: string | null;
  created_at: Date | string;
  author_name: string;
  author_avatar: string | null;
}

interface PurchaseRow {
  id: number;
  description: string;
  image_url: string | null;
  image_urls: string | null;
  created_at: Date | string;
}

function extractUrls(primary: string | null, extraJson: string | null): string[] {
  const urls: string[] = [];
  const pushUrl = (u: unknown) => {
    if (typeof u !== 'string') return;
    const trimmed = u.trim();
    if (!trimmed) return;
    if (!urls.includes(trimmed)) {
      urls.push(trimmed);
    }
  };

  if (primary) {
    pushUrl(primary);
  }

  if (extraJson) {
    try {
      const parsed: unknown = JSON.parse(extraJson);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          pushUrl(item);
        }
      }
    } catch {
      // Ignora JSON malformado e mantém a foto principal se existir
    }
  }

  return urls;
}

function toIso(d: Date | string): string {
  return (d instanceof Date ? d : new Date(d)).toISOString();
}

export const GET = route(async (req) => {
  await requireUser();

  const { searchParams } = new URL(req.url);
  const cursorParam = searchParams.get('cursor');
  const limitParam = searchParams.get('limit');

  let limit = 40;
  if (limitParam !== null && limitParam !== '') {
    const parsed = Number(limitParam);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new HttpError(400, 'Limite inválido.');
    }
    limit = Math.min(parsed, 100);
  }

  let cursorIso: string | null = null;
  if (cursorParam !== null && cursorParam.trim() !== '') {
    const d = new Date(cursorParam);
    if (Number.isNaN(d.getTime())) {
      throw new HttpError(400, 'Cursor de data inválido.');
    }
    cursorIso = d.toISOString();
  }

  const rowFetchLimit = limit + 10;

  const postsPromise = cursorIso
    ? query<PostRow>(
        `SELECT p.id, p.content, p.image_url, p.image_urls, p.created_at,
                u.name AS author_name, u.avatar_url AS author_avatar
           FROM family_posts p
           JOIN family_users u ON u.id = p.user_id
          WHERE ((p.image_url IS NOT NULL AND p.image_url <> '')
             OR (p.image_urls IS NOT NULL AND p.image_urls <> '' AND p.image_urls <> '[]'))
            AND p.created_at < $1
          ORDER BY p.created_at DESC, p.id DESC
          LIMIT $2`,
        [cursorIso, rowFetchLimit],
      )
    : query<PostRow>(
        `SELECT p.id, p.content, p.image_url, p.image_urls, p.created_at,
                u.name AS author_name, u.avatar_url AS author_avatar
           FROM family_posts p
           JOIN family_users u ON u.id = p.user_id
          WHERE (p.image_url IS NOT NULL AND p.image_url <> '')
             OR (p.image_urls IS NOT NULL AND p.image_urls <> '' AND p.image_urls <> '[]')
          ORDER BY p.created_at DESC, p.id DESC
          LIMIT $1`,
        [rowFetchLimit],
      );

  const purchasesPromise = cursorIso
    ? query<PurchaseRow>(
        `SELECT c.id, c.description, c.image_url, c.image_urls, c.created_at
           FROM purchases c
          WHERE ((c.image_url IS NOT NULL AND c.image_url <> '')
             OR (c.image_urls IS NOT NULL AND c.image_urls <> '' AND c.image_urls <> '[]'))
            AND c.created_at < $1
          ORDER BY c.created_at DESC, c.id DESC
          LIMIT $2`,
        [cursorIso, rowFetchLimit],
      )
    : query<PurchaseRow>(
        `SELECT c.id, c.description, c.image_url, c.image_urls, c.created_at
           FROM purchases c
          WHERE (c.image_url IS NOT NULL AND c.image_url <> '')
             OR (c.image_urls IS NOT NULL AND c.image_urls <> '' AND c.image_urls <> '[]')
          ORDER BY c.created_at DESC, c.id DESC
          LIMIT $1`,
        [rowFetchLimit],
      );

  const [postsRes, purchasesRes] = await Promise.all([postsPromise, purchasesPromise]);

  const combined: AlbumItem[] = [];

  for (const row of postsRes.rows) {
    const urls = extractUrls(row.image_url, row.image_urls);
    const createdAt = toIso(row.created_at);
    urls.forEach((url, idx) => {
      combined.push({
        key: `post-${row.id}-${idx}`,
        url,
        source: 'post',
        post_id: row.id,
        author_name: row.author_name,
        author_avatar: row.author_avatar,
        caption: row.content ?? '',
        created_at: createdAt,
      });
    });
  }

  for (const row of purchasesRes.rows) {
    const urls = extractUrls(row.image_url, row.image_urls);
    const createdAt = toIso(row.created_at);
    urls.forEach((url, idx) => {
      combined.push({
        key: `compra-${row.id}-${idx}`,
        url,
        source: 'compra',
        caption: row.description ?? '',
        created_at: createdAt,
      });
    });
  }

  combined.sort((a, b) => {
    const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (diff !== 0) return diff;
    return a.key.localeCompare(b.key);
  });

  const hasMore = combined.length > limit;
  const items = hasMore ? combined.slice(0, limit) : combined;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].created_at : null;

  return ok({ items, nextCursor });
});
