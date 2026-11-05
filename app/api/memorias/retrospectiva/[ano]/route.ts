import { ok, requireUser, route } from '@/app/lib/api';
import { getRetrospective } from '../../data';
export const GET = route<{ params: Promise<{ ano: string }> }>(async (_req, ctx) => {
  const me = await requireUser(); const { ano } = await ctx.params;
  return ok(await getRetrospective(me, ano));
});
