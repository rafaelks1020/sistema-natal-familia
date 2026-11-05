import { HttpError, ok, requireUser, route, toInt } from '@/app/lib/api';
import { query } from '@/app/lib/db';

type Context = { params: Promise<{ id: string }> };
export const GET = route<Context>(async (_req, { params }) => {
  const me = await requireUser();
  const id = toInt((await params).id);
  const { rows } = await query(`
    SELECT u.id, u.name${me.is_admin || id === me.id ? ", u.username" : ""}, u.avatar_url, u.bio, u.is_admin, p.id AS participant_id,
      (SELECT COUNT(*)::int FROM family_posts f WHERE f.user_id = u.id) AS posts_count,
      (SELECT COUNT(*)::int FROM family_post_reactions r JOIN family_posts f ON f.id = r.post_id
        WHERE f.user_id = u.id) AS reactions_received,
      (SELECT COUNT(*)::int FROM family_post_comments c WHERE c.user_id = u.id) AS comments_count
    FROM family_users u LEFT JOIN participants p ON p.user_id = u.id WHERE u.id = $1`, [id]);
  if (!rows[0]) throw new HttpError(404, 'Pessoa não encontrada.');
  const { rows: wishlist } = await query(`
    SELECT w.id, w.participant_id, w.config_id, w.item_name, w.item_description,
           w.item_url, w.priority, w.created_at${id === me.id ? '' : ', w.purchased'}
      FROM wish_list w
     WHERE w.participant_id = $1 AND w.config_id = (
       SELECT id FROM secret_santa_config WHERE is_active = true ORDER BY created_at DESC, id DESC LIMIT 1)
     ORDER BY w.priority DESC, w.created_at, w.id`, [rows[0].participant_id]);
  return ok({ ...rows[0], wishlist });
});
