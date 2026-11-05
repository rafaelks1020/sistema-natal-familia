import 'server-only';
import { query } from '@/app/lib/db';
import type { SessionUser } from '@/app/lib/session';
import type { PostItem } from '@/app/(app)/mural/types';
import { parsePostImages } from './_utils';

export async function getFeed(
  me: SessionUser,
  { limit = 20, before = null, userId = null }: { limit?: number; before?: number | null; userId?: number | null } = {},
): Promise<PostItem[]> {
  const { rows } = await query(
    `SELECT
       p.id,
       p.user_id,
       u.name AS user_name,
       u.avatar_url,
       p.content,
       p.image_url,
       p.image_urls,
       COALESCE(p.pinned, false) AS pinned,
       p.created_at,
       p.updated_at,
       COALESCE(r.reactions, '{}'::jsonb) AS reactions,
       COALESCE(mr.my_reactions, '[]'::jsonb) AS my_reactions,
       COALESCE(c.comments, '[]'::jsonb) AS comments,
       (SELECT COUNT(*)::int FROM family_post_comments WHERE post_id = p.id) AS comments_count
     FROM family_posts p
     JOIN family_users u ON u.id = p.user_id
     LEFT JOIN LATERAL (
       SELECT jsonb_object_agg(reaction_type, cnt) AS reactions
       FROM (
         SELECT reaction_type, COUNT(*)::int AS cnt
         FROM family_post_reactions
         WHERE post_id = p.id
         GROUP BY reaction_type
       ) rx
     ) r ON TRUE
     LEFT JOIN LATERAL (
       SELECT jsonb_agg(reaction_type ORDER BY id ASC) AS my_reactions
       FROM family_post_reactions
       WHERE post_id = p.id AND user_id = $1
     ) mr ON TRUE
     LEFT JOIN LATERAL (
       SELECT jsonb_agg(
         jsonb_build_object(
           'id', cm.id,
           'user_id', cm.user_id,
           'user_name', cu.name,
           'avatar_url', cu.avatar_url,
           'content', cm.content,
           'created_at', cm.created_at,
           'likes', COALESCE(cl.likes_count, 0),
           'liked_by_me', COALESCE(cl.liked_by_me, false)
         )
         ORDER BY cm.created_at ASC, cm.id ASC
       ) AS comments
       FROM (
         SELECT * FROM family_post_comments
         WHERE post_id = p.id
         ORDER BY created_at DESC, id DESC
         LIMIT 3
       ) cm
       JOIN family_users cu ON cu.id = cm.user_id
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*)::int AS likes_count,
           BOOL_OR(user_id = $1) AS liked_by_me
         FROM family_comment_likes
         WHERE comment_id = cm.id
       ) cl ON TRUE
       WHERE cm.post_id = p.id
     ) c ON TRUE
     WHERE ($2::int IS NULL OR p.user_id = $2)
       AND ($3::int IS NULL OR (NOT COALESCE(p.pinned, false) AND p.id < $3))
     ORDER BY COALESCE(p.pinned, false) DESC, p.id DESC
     LIMIT $4`,
    [me.id, userId, before, limit],
  );

  const posts = rows.map((row) => ({
    id: Number(row.id),
    user_id: Number(row.user_id),
    user_name: String(row.user_name),
    avatar_url: row.avatar_url ?? null,
    content: String(row.content ?? ''),
    images: parsePostImages(row.image_urls, row.image_url),
    pinned: Boolean(row.pinned),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at ?? null,
    reactions: (row.reactions ?? {}) as Record<string, number>,
    my_reactions: Array.isArray(row.my_reactions) ? (row.my_reactions as string[]) : [],
    comments: Array.isArray(row.comments) ? row.comments : [],
    comments_count: Number(row.comments_count),
  }));

  return posts;
}
