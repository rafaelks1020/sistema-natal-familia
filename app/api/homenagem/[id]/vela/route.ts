import { ok, requireUser, route, toInt } from '@/app/lib/api';
import { acenderVela } from '../../_data';

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (_req, ctx) => {
  const me = await requireUser();
  await acenderVela(me.id, toInt((await ctx.params).id));
  return ok({ ok: true });
});
