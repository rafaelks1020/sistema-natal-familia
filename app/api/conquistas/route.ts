import { ok, requireUser, route, toInt } from '@/app/lib/api';
import { carregarConquistas } from '@/app/lib/conquistas';

export const GET = route(async (req) => {
  const me = await requireUser();
  const id = new URL(req.url).searchParams.get('user_id');
  return ok(await carregarConquistas(me.id, id === null ? me.id : toInt(id, 'pessoa')));
});
