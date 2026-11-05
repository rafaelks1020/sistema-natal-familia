import { query } from '@/app/lib/db';
import { HttpError, ok, requireAdmin, route, toInt } from '@/app/lib/api';

type RouteContext = { params: Promise<{ id: string }> };

export const DELETE = route<RouteContext>(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const purchaseId = toInt(id, 'id');

  const { rowCount } = await query(`DELETE FROM purchases WHERE id = $1`, [purchaseId]);
  if (!rowCount) {
    throw new HttpError(404, 'Gasto não encontrado.');
  }

  return ok({ ok: true });
});
