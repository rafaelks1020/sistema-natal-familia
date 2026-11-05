import { query } from '@/app/lib/db';
import { ok, requireUser, route, toInt } from '@/app/lib/api';

type Context = { params: Promise<{ userId: string }> };
export const DELETE = route<Context>(async (_req, { params }) => {
  const me = await requireUser();
  const id = toInt((await params).userId, 'userId');
  await query('DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2', [me.id, id]);
  return ok({ ok: true });
});
