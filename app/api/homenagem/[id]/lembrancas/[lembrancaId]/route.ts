import { ok, requireUser, route, toInt } from '@/app/lib/api';
import { apagarLembranca } from '../../../_data';

type Ctx = { params: Promise<{ id: string; lembrancaId: string }> };

export const DELETE = route<Ctx>(async (_req, ctx) => {
  const me = await requireUser();
  const { id, lembrancaId } = await ctx.params;
  await apagarLembranca(me, toInt(id), toInt(lembrancaId));
  return ok({ ok: true });
});
