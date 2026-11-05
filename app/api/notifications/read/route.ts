import { query } from '@/app/lib/db';
import { ok, requireUser, route } from '@/app/lib/api';

// POST /api/notifications/read -> marca todas como lidas

export const POST = route(async () => {
  const me = await requireUser();

  await query(
    `UPDATE family_notifications
        SET read_at = NOW()
      WHERE user_id = $1 AND read_at IS NULL`,
    [me.id],
  );

  return ok({ ok: true });
});
