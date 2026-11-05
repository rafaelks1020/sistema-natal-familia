import { query } from '@/app/lib/db';
import { ok, readJson, requireAdmin, route } from '@/app/lib/api';
import { edicaoAtual } from '@/app/lib/edicao';
import { parsePurchase } from './_validation';

export const POST = route(async req => {
  await requireAdmin();
  const body = await readJson<Record<string, unknown>>(req);
  const p = parsePurchase(body);
  const { rows } = await query<{ id: number }>(
    `INSERT INTO purchases(description, value, value_centavos, category, brand, color, size, quantity,
       notes, image_url, image_urls, receipt_url, ano)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [p.description, p.value, Math.round(p.value * 100), p.category, p.brand, p.color, p.size,
      p.quantity, p.notes, p.imageUrl, p.imageUrls, p.receipt_url, edicaoAtual()]);
  return ok({ id: rows[0].id }, 201);
});
