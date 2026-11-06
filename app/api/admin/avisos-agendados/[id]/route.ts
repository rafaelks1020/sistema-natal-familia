import { ok, requireAdmin, route, toInt } from '@/app/lib/api';
import { cancelarAviso } from '@/app/lib/admin/avisos';

type Context = { params: Promise<{ id: string }> };

export const DELETE = route<Context>(async (_req, { params }) => {
  const me = await requireAdmin();
  const { id } = await params;
  await cancelarAviso(me, toInt(id, 'id'));
  return ok({ ok: true });
});
