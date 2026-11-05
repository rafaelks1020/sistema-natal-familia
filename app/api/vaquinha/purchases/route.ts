import { query } from '@/app/lib/db';
import { cleanText, HttpError, ok, readJson, requireAdmin, route, toInt } from '@/app/lib/api';
import { ALLOWED_CATEGORIES, parseImages, PurchaseCategory, roundMoney } from '../_helpers';

function parseMoneyValue(raw: unknown): number {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0 || raw > 99_999_999.99) {
      throw new HttpError(400, 'Informe um valor maior que zero.');
    }
    return roundMoney(raw);
  }
  if (typeof raw === 'string') {
    const cleaned = raw.replace(/R\$/gi, '').replace(/\s+/g, '').trim();
    if (!cleaned) throw new HttpError(400, 'Informe o valor do gasto.');
    const normalized = cleaned.includes(',')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned;
    const num = Number(normalized);
    if (!Number.isFinite(num) || num <= 0 || num > 99_999_999.99) {
      throw new HttpError(400, 'Informe um valor maior que zero.');
    }
    return roundMoney(num);
  }
  throw new HttpError(400, 'Informe o valor do gasto.');
}

function validateImages(raw: unknown): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new HttpError(400, 'Lista de fotos inválida.');
  }
  if (raw.length > 6) {
    throw new HttpError(400, 'Envie no máximo 6 fotos por gasto.');
  }
  const urls: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') {
      throw new HttpError(400, 'Endereço de foto inválido.');
    }
    const url = item.trim();
    if (!url.startsWith('https://') || url.length > 600) {
      throw new HttpError(400, 'As fotos precisam ter endereço https válido.');
    }
    urls.push(url);
  }
  return urls;
}

export const POST = route(async (req) => {
  await requireAdmin();
  const body = await readJson<Record<string, unknown>>(req);

  const description = cleanText(body.description, 'a descrição', 160);
  const value = parseMoneyValue(body.value);

  const categoryRaw = typeof body.category === 'string' ? body.category.trim() : '';
  if (!ALLOWED_CATEGORIES.includes(categoryRaw as PurchaseCategory)) {
    throw new HttpError(400, 'Escolha uma categoria válida.');
  }
  const category = categoryRaw as PurchaseCategory;

  const brand = cleanText(body.brand, 'a marca', 80, false) || null;
  const color = cleanText(body.color, 'a cor', 60, false) || null;
  const size = cleanText(body.size, 'o tamanho', 60, false) || null;
  const notes = cleanText(body.notes, 'as observações', 600, false) || null;

  const quantity =
    body.quantity === undefined || body.quantity === null || body.quantity === ''
      ? 1
      : toInt(body.quantity, 'quantidade');
  if (quantity > 9999) {
    throw new HttpError(400, 'Quantidade máxima excedida.');
  }

  const images = validateImages(body.images);
  const imageUrl = images[0] ?? null;
  const imageUrls = images.length > 0 ? JSON.stringify(images) : null;

  const { rows } = await query<{
    id: number;
    description: string;
    value: string | number;
    category: string;
    brand: string | null;
    color: string | null;
    size: string | null;
    quantity: number;
    notes: string | null;
    image_url: string | null;
    image_urls: string | null;
    created_at: Date | string;
  }>(
    `INSERT INTO purchases (
       description, value, category, brand, color, size, quantity, notes, image_url, image_urls
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, description, value, category, brand, color, size, quantity, notes,
               image_url, image_urls, created_at`,
    [description, value, category, brand, color, size, quantity, notes, imageUrl, imageUrls],
  );

  const row = rows[0];
  return ok(
    {
      id: row.id,
      description: row.description,
      value: roundMoney(Number(row.value)),
      category: row.category,
      brand: row.brand ?? null,
      color: row.color ?? null,
      size: row.size ?? null,
      quantity: Number(row.quantity) || 1,
      notes: row.notes ?? null,
      images: parseImages(row.image_url, row.image_urls),
      created_at: new Date(row.created_at).toISOString(),
    },
    201,
  );
});
