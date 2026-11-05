import { query } from '@/app/lib/db';
import { ok, requireUser, route } from '@/app/lib/api';

// GET /api/notifications -> { unread, items:[{ id, type, actor_name, actor_avatar, post_id, reaction_type, created_at, read }] }

export const GET = route(async () => {
  const me = await requireUser();

  const [unreadRes, itemsRes] = await Promise.all([
    query<{ unread: number }>(
      `SELECT COUNT(*)::int AS unread
         FROM family_notifications
        WHERE user_id = $1 AND read_at IS NULL`,
      [me.id],
    ),
    query(
      `SELECT
         n.id,
         n.type,
         actor.name AS actor_name,
         actor.avatar_url AS actor_avatar,
         n.post_id,
         n.reaction_type,
         n.created_at,
         (n.read_at IS NOT NULL) AS read
       FROM family_notifications n
       JOIN family_users actor ON actor.id = n.actor_id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT 30`,
      [me.id],
    ),
  ]);

  const unread = Number(unreadRes.rows[0]?.unread ?? 0);
  const items = itemsRes.rows.map((row) => ({
    id: Number(row.id),
    type: String(row.type),
    actor_name: String(row.actor_name),
    actor_avatar: row.actor_avatar ?? null,
    post_id: row.post_id !== null && row.post_id !== undefined ? Number(row.post_id) : null,
    reaction_type: row.reaction_type ?? null,
    created_at: row.created_at,
    read: Boolean(row.read),
  }));

  return ok({ unread, items });
});
