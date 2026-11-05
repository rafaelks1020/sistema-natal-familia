import { cleanText, HttpError, isBlobUrl, toInt } from '@/app/lib/api';
import { ALLOWED_CATEGORIES, PurchaseCategory, roundMoney } from '../_helpers';

export function parseMoneyValue(raw: unknown): number {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0 || raw > 99_999_999.99 || Math.abs(raw - roundMoney(raw)) > 1e-8) {
      throw new HttpError(400, 'Informe um valor maior que zero.');
    }
    return roundMoney(raw);
  }
  if (typeof raw === 'string') {
    const cleaned = raw.replace(/R\$/gi, '').replace(/\s+/g, '').trim();
    if (!cleaned) throw new HttpError(400, 'Informe o valor do gasto.');
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(cleaned) && !/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(cleaned)) {
      throw new HttpError(400, 'Informe um valor em reais com até duas casas decimais.');
    }
    const normalized = cleaned.includes(',')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : /^\d{1,3}(?:\.\d{3})+$/.test(cleaned) ? cleaned.replace(/\./g, '') : cleaned;
    const num = Number(normalized);
    if (!Number.isFinite(num) || num <= 0 || num > 99_999_999.99) {
      throw new HttpError(400, 'Informe um valor maior que zero.');
    }
    return roundMoney(num);
  }
  throw new HttpError(400, 'Informe o valor do gasto.');
}

export function validateImages(raw: unknown): string[] {
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
    if (!isBlobUrl(url)) {
      throw new HttpError(400, 'As fotos precisam ser enviadas pelo aplicativo.');
    }
    urls.push(url);
  }
  return urls;
}

export function parsePurchase(body: Record<string, unknown>) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Dados inválidos.');
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

  const receipt_url = body.receipt_url || null;
  if (receipt_url && !isBlobUrl(receipt_url)) throw new HttpError(400, 'Envie o comprovante pelo aplicativo.');
  return { description, value, category, brand, color, size, quantity, notes, images, imageUrl, imageUrls, receipt_url };
}
