import { ok, requireUser, route } from '@/app/lib/api';
import { query } from '@/app/lib/db';

export const GET = route(async () => {
  await requireUser();
  const { rows } = await query(`
    SELECT u.id, COALESCE(u.name, p.name) AS name, u.username, u.avatar_url, u.bio,
           COALESCE(u.is_admin, false) AS is_admin, p.id AS participant_id,
           a.status AS attendance, (u.id IS NOT NULL) AS has_login,
           (SELECT COUNT(*)::int FROM family_posts f WHERE f.user_id = u.id) AS posts_count
      FROM family_users u FULL OUTER JOIN participants p ON p.user_id = u.id
      LEFT JOIN family_attendance a ON a.participant_id = p.id
     ORDER BY COALESCE(u.name, p.name), p.id, u.id`);
  return ok(rows);
});
