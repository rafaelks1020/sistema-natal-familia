import { ok, requireUser, route } from '@/app/lib/api';
import { canReveal, loadActiveConfig, loadMyDraw, Receiver } from './shared';

// GET /api/secret-santa
// { config, participating, draw }
// draw.receiver só existe quando a própria pessoa já revelou. Sem token na URL.

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const me = await requireUser();
  const config = await loadActiveConfig();

  const can_reveal = canReveal(config);
  const availability = { can_reveal, reveal_opens_at: config?.reveal_date ?? null };

  if (!config || !me.participant_id) {
    return ok({ ...availability, config, participating: false, draw: null });
  }

  const mine = await loadMyDraw(me.participant_id, config.id);
  if (!mine) {
    return ok({ ...availability, config, participating: false, draw: null });
  }

  const draw: { revealed: boolean; receiver?: Receiver } = can_reveal && mine.revealed && mine.receiver
    ? { revealed: true, receiver: mine.receiver }
    : { revealed: false };

  return ok({ ...availability, config, participating: true, draw });
});
