import { ok, requireUser, route } from '@/app/lib/api';
import { carregarCeia } from './dados';

export const GET = route(async () => {
  const me = await requireUser();
  return ok(await carregarCeia(me));
});
