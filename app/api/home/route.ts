import { ok, requireUser, route } from '@/app/lib/api';
import { getHome } from './data';

export const GET = route(async () => {
  const me = await requireUser();
  return ok(await getHome(me));
});
