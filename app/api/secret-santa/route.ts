import { ok, requireUser, route } from '@/app/lib/api';
import { loadActiveConfig, loadMyDraw, Receiver } from './shared';

// GET /api/secret-santa
// { config, participating, draw }
// draw.receiver só existe quando a própria pessoa já revelou. Sem token na URL.

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const me = await requireUser();
  const config = await loadActiveConfig();

  if (!config || !me.participant_id) {
    return ok({ config, participating: false, draw: null });
  }

  const mine = await loadMyDraw(me.participant_id, config.id);
  if (!mine) {
    return ok({ config, participating: false, draw: null });
  }

  const draw: { revealed: boolean; receiver?: Receiver } = mine.revealed && mine.receiver
    ? { revealed: true, receiver: mine.receiver }
    : { revealed: false };

  return ok({ config, participating: true, draw });
});
