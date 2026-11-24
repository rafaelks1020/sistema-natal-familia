import { ok, requireUser, route } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { CONTA_REVISAO_LOJAS } from '@/app/lib/gamificacao/motor';
import { discardableParticipant } from './link/eligibility';

export const GET = route(async () => {
  const me = await requireUser();
  const { rows } = await query(`
    SELECT u.id, COALESCE(u.name, p.name) AS name, u.avatar_url, u.bio,
           COALESCE(u.is_admin, false) AS is_admin, p.id AS participant_id,
           a.status AS attendance, (u.id IS NOT NULL) AS has_login,
           (SELECT COUNT(*)::int FROM family_posts f WHERE f.user_id = u.id) AS posts_count,
           CASE WHEN $1::boolean OR u.id = $2 THEN u.username END AS username
           ${me.is_admin ? `, (p.id IS NOT NULL AND ${discardableParticipant}) AS can_link` : ''}
      FROM family_users u FULL OUTER JOIN participants p ON p.user_id = u.id
      LEFT JOIN family_attendance a ON a.participant_id = p.id
     -- A conta que a Apple e o Google usam para revisar o app não aparece para a família (só para quem organiza).
     WHERE $1::boolean OR u.name IS DISTINCT FROM $3
     ORDER BY COALESCE(u.name, p.name), p.id, u.id`, [me.is_admin, me.id, CONTA_REVISAO_LOJAS]);
  return ok(rows.map(({ username, ...member }) =>
    me.is_admin || member.id === me.id ? { ...member, username } : member));
});
