import 'server-only';
import { HttpError, readJson, toInt } from '@/app/lib/api';
import type { SessionUser } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import type { AlbumItem, AlbumMetadata, AlbumPerson, AlbumResponse } from './types';
export type { AlbumItem, AlbumResponse } from './types';

export async function readAlbumJson(req: Request): Promise<Record<string, unknown>> {
  const body = await readJson<unknown>(req);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Dados inválidos.');
  return body as Record<string, unknown>;
}

export function albumYear(value: unknown = edicaoAtual()): number {
  const year = toInt(value, 'ano');
  if (year < 1900 || year > edicaoAtual()) throw new HttpError(400, 'Escolha uma edição válida, até a edição atual.');
  return year;
}

// $1 é sempre a identidade da sessão. Todas as leituras, inclusive memórias, excluem bloqueados.
export const PHOTO_CTE = `WITH sources AS (
  SELECT p.id, 'post'::text AS source, p.ano, p.user_id, p.content AS caption,
    p.image_url, p.image_urls,
    p.created_at::timestamptz AS created_at,
    (p.created_at::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date AS taken_on,
    (SELECT count(*)::int FROM family_post_reactions r WHERE r.post_id = p.id
      AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $1 AND b.blocked_id = r.user_id)) AS likes,
    (SELECT count(*)::int FROM family_post_comments c WHERE c.post_id = p.id
      AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $1 AND b.blocked_id = c.user_id)) AS comments,
    EXISTS(SELECT 1 FROM family_post_reactions r WHERE r.post_id = p.id AND r.user_id = $1) AS liked
  FROM family_posts p
  UNION ALL
  SELECT id, 'compra', ano, NULL::int, description, image_url, image_urls, created_at::timestamptz, (created_at::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date, 0, 0, false FROM purchases
  UNION ALL
  SELECT a.id, 'album', a.ano, a.user_id, a.caption, a.image_url, NULL::text,
    (a.taken_on::timestamp + interval '12 hours') AT TIME ZONE 'America/Sao_Paulo', a.taken_on,
    (SELECT count(*)::int FROM album_photo_likes l WHERE l.photo_id = a.id
      AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $1 AND b.blocked_id = l.user_id)), 0,
    EXISTS(SELECT 1 FROM album_photo_likes l WHERE l.photo_id = a.id AND l.user_id = $1)
  FROM album_photos a
), photos AS (
  SELECT s.id, s.source, s.ano, s.user_id, s.caption, s.likes, s.comments, s.liked,
    s.source || '-' || s.id || '-' || (image.ordinality - 1) AS key, image.url,
    to_char(s.created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS.US') AS sort_date,
    to_char(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') || 'Z' AS created_at,
    to_char(s.taken_on, 'YYYY-MM-DD') AS taken_on,
    COALESCE(u.name, 'Compras da ceia') AS author_name, u.avatar_url AS author_avatar
  FROM sources s CROSS JOIN LATERAL unnest(album_urls(s.image_urls, s.image_url)) WITH ORDINALITY AS image(url, ordinality)
  LEFT JOIN family_users u ON u.id = s.user_id
  WHERE NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $1 AND b.blocked_id = s.user_id)
)`;

interface PhotoRow extends Omit<AlbumItem, 'tags' | 'can_edit'> { id: number; sort_date: string }

export async function getPeople(user: SessionUser): Promise<AlbumPerson[]> {
  const { rows } = await query<{ id: number; name: string }>(`SELECT id, name FROM family_users u
    WHERE NOT EXISTS(SELECT 1 FROM user_blocks b WHERE b.blocker_id = $1 AND b.blocked_id = u.id) ORDER BY name, id`, [user.id]);
  const people: AlbumPerson[] = rows.map(p => ({ ...p, source: 'user' }));
  const exists = await query<{ exists: boolean }>("SELECT to_regclass('public.family_tree_people') IS NOT NULL AS exists");
  if (exists.rows[0].exists) {
    // A árvore é opcional. to_jsonb permite ignorar campos opcionais de outra parte.
    const tree = await query<{ person: Record<string, unknown> }>(`SELECT to_jsonb(p) AS person FROM family_tree_people p WHERE NOT EXISTS(SELECT 1 FROM user_blocks b WHERE b.blocker_id = $1 AND b.blocked_id = (to_jsonb(p)->>'criado_por')::int)`, [user.id]);
    for (const { person: p } of tree.rows) {
      if (p.user_id || p.family_user_id) continue;
      const id = Number(p.id); const name = String(p.name ?? p.nome ?? '').trim();
      if (Number.isSafeInteger(id) && id > 0 && name) people.push({ id, name, source: 'tree' });
    }
  }
  return people;
}

export async function getAlbumMetadata(user: SessionUser): Promise<AlbumMetadata> {
  const [years, people] = await Promise.all([
    query<{ ano: number }>(`${PHOTO_CTE} SELECT DISTINCT ano FROM photos ORDER BY ano DESC`, [user.id]), getPeople(user),
  ]);
  return { currentYear: edicaoAtual(), years: [...new Set([edicaoAtual(), 2025, ...years.rows.map(r => r.ano).filter(y => y >= 1900 && y <= edicaoAtual())])].sort((a, b) => b - a), people, isAdmin: user.is_admin };
}

export async function decoratePhotos(user: SessionUser, rows: PhotoRow[]): Promise<AlbumItem[]> {
  if (!rows.length) return [];
  const [tags, people] = await Promise.all([
    query<{ photo_key: string; person_source: string; person_id: number; image_url: string }>('SELECT photo_key, person_source, person_id, image_url FROM album_tags WHERE photo_key = ANY($1::text[])', [rows.map(r => r.key)]),
    getPeople(user),
  ]);
  const names = new Map(people.map(p => [`${p.source}:${p.id}`, p]));
  return rows.map(row => ({
    key: row.key, url: row.url, source: row.source, user_id: row.user_id,
    caption: row.caption, author_name: row.author_name, author_avatar: row.author_avatar,
    created_at: row.created_at, taken_on: row.taken_on, ano: row.ano,
    likes: row.likes, comments: row.comments, liked: row.liked,
    ...(row.source === 'post' ? { post_id: row.id } : row.source === 'album' ? { photo_id: row.id } : {}),
    can_edit: user.is_admin || row.user_id === user.id,
    tags: tags.rows.filter(t => t.photo_key === row.key && t.image_url === row.url).flatMap(t => names.get(`${t.person_source}:${t.person_id}`) ?? []),
  }));
}

export async function getAlbum(user: SessionUser, { cursor: rawCursor = null, limit = 40, ano = edicaoAtual(), pessoa, all = false }:
  { cursor?: string | null; limit?: number; ano?: number; pessoa?: string | null; all?: boolean } = {}): Promise<AlbumResponse> {
  albumYear(ano);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new HttpError(400, 'Limite inválido (1 a 100).');
  if (pessoa && !/^(user|tree):[1-9]\d*$/.test(pessoa)) throw new HttpError(400, 'Pessoa inválida.');
  let cursor: { date: string; key: string } | null = null;
  if (rawCursor) {
    try {
      cursor = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8'));
      if (!cursor || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(cursor.date)
        || !/^(post|compra|album)-[1-9]\d*-\d+$/.test(cursor.key)) throw new Error();
    } catch { throw new HttpError(400, 'Cursor do álbum inválido.'); }
  }
  const { rows } = await query<PhotoRow>(`${PHOTO_CTE} SELECT * FROM photos p
    WHERE ano = $2 AND ($3::text IS NULL OR EXISTS(SELECT 1 FROM album_tags t WHERE t.photo_key = p.key AND t.image_url = p.url
      AND t.person_source || ':' || t.person_id = $3))
    AND ($4::text IS NULL OR (sort_date, key COLLATE "C") < ($4::text, $5::text COLLATE "C"))
    ORDER BY sort_date DESC, key COLLATE "C" DESC LIMIT $6`,
  [user.id, ano, pessoa || null, cursor?.date ?? null, cursor?.key ?? null, all ? null : limit + 1]);
  const page = all ? rows : rows.slice(0, limit); const last = page.at(-1);
  return { items: await decoratePhotos(user, page), nextCursor: !all && rows.length > limit && last
    ? Buffer.from(JSON.stringify({ date: last.sort_date, key: last.key })).toString('base64url') : null };
}

export async function findPhoto(user: SessionUser, key: unknown, includeBlocked = false): Promise<PhotoRow> {
  if (typeof key !== 'string' || !/^(post|compra|album)-[1-9]\d*-\d+$/.test(key)) throw new HttpError(400, 'Foto inválida.');
  const { rows } = await query<PhotoRow>(`${PHOTO_CTE} SELECT * FROM photos WHERE key = $2`, [includeBlocked && user.is_admin ? null : user.id, key]);
  if (!rows[0]) throw new HttpError(404, 'Foto não encontrada.');
  return rows[0];
}
