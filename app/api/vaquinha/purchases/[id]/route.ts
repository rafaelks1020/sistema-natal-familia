import { query } from '@/app/lib/db';
import { HttpError, ok, readJson, requireAdmin, route, toInt } from '@/app/lib/api';

import { edicaoAtual } from '@/app/lib/edicao';
import { parsePurchase } from '../_validation';

type RouteContext = { params: Promise<{ id: string }> };

export const DELETE = route<RouteContext>(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const purchaseId = toInt(id, 'id');

  const { rowCount } = await query(`DELETE FROM purchases WHERE id = $1 AND ano = $2`, [purchaseId, edicaoAtual()]);
  if (!rowCount) {
    throw new HttpError(404, 'Gasto não encontrado.');
  }

  return ok({ ok: true });
});

export const PUT = route<RouteContext>(async (req, { params }) => {
  await requireAdmin();
  const id = toInt((await params).id);
  const p = parsePurchase(await readJson<Record<string, unknown>>(req));
  const result = await query(`UPDATE purchases SET description=$1, value=$2, value_centavos=$3,
    category=$4, brand=$5, color=$6, size=$7, quantity=$8, notes=$9, image_url=$10,
    image_urls=$11, receipt_url=$12 WHERE id=$13 AND ano=$14 RETURNING id`,
  [p.description, p.value, Math.round(p.value * 100), p.category, p.brand, p.color, p.size,
    p.quantity, p.notes, p.imageUrl, p.imageUrls, p.receipt_url, id, edicaoAtual()]);
  if (!result.rowCount) throw new HttpError(404, 'Gasto não encontrado nesta edição.');
  return ok({ ok: true });
});
