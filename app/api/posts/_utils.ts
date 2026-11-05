import { HttpError, isBlobUrl } from '@/app/lib/api';

const MAX_IMAGES = 6;

export function parsePostImages(imageUrlsRaw: unknown, imageUrlSingle: unknown): string[] {
  const out: string[] = [];
  if (typeof imageUrlsRaw === 'string' && imageUrlsRaw.trim()) {
    try {
      const parsed = JSON.parse(imageUrlsRaw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === 'string' && isBlobUrl(item.trim()) && !out.includes(item.trim())) {
            out.push(item.trim());
          }
        }
      }
    } catch {
      // ignora JSON malformado legado
    }
  }
  if (typeof imageUrlSingle === 'string' && imageUrlSingle.trim()) {
    const single = imageUrlSingle.trim();
    if (isBlobUrl(single) && !out.includes(single)) {
      out.unshift(single);
    }
  }
  return out;
}

export function validateImagesInput(raw: unknown): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new HttpError(400, 'Lista de fotos inválida.');
  }
  if (raw.length > MAX_IMAGES) {
    throw new HttpError(400, `Envie no máximo ${MAX_IMAGES} fotos por publicação.`);
  }
  const clean: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') {
      throw new HttpError(400, 'URL de foto inválida.');
    }
    const url = item.trim();
    if (!isBlobUrl(url)) {
      throw new HttpError(400, 'Use uma foto enviada pelo aplicativo.');
    }
    if (url.length > 1000) {
      throw new HttpError(400, 'URL de foto muito longa.');
    }
    clean.push(url);
  }
  return clean;
}
