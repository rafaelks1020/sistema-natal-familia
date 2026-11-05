import { ok, requireUser, route } from '@/app/lib/api';
import { carregarVaquinha } from './_data';

export const GET = route(async () => {
  await requireUser();
  return ok(await carregarVaquinha());
});
