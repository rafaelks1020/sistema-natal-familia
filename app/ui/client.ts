'use client';

// Cliente das rotas /api: devolve o JSON ou lança Error com a mensagem do servidor.
// 401 manda para /entrar (sessão expirou).

export async function api<T = any>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, headers, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    headers: json !== undefined ? { 'Content-Type': 'application/json', ...headers } : headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: 'no-store',
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* corpo vazio */
  }
  if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/api/auth')) {
    window.location.href = '/entrar';
  }
  if (!res.ok) throw new Error(data?.error || 'Não deu certo. Tente de novo.');
  return data as T;
}

/**
 * Reduz a foto no próprio celular antes de enviar (lado maior 1600 px, JPEG 0,82).
 * Foto de 8 MB vira ~300 KB: sobe rápido no 4G e o mural abre leve para todo mundo.
 * Se o navegador não conseguir abrir o formato (ex.: HEIC fora do Safari), manda o original.
 */
async function comprimir(file: File, lado = 1600, qualidade = 0.82): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const escala = Math.min(1, lado / Math.max(bmp.width, bmp.height));
    if (escala === 1 && file.size < 900_000) {
      bmp.close();
      return file;
    }
    const w = Math.round(bmp.width * escala);
    const h = Math.round(bmp.height * escala);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', qualidade));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/** Envia uma foto para /api/upload (já comprimida) e devolve a URL pública. */
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', await comprimir(file));
  const { url } = await api<{ url: string }>('/api/upload', { method: 'POST', body: form });
  return url;
}

export const brl = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function timeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return 'agora';
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias < 7) return dias === 1 ? 'ontem' : `há ${dias} dias`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}


export { thumb } from './thumb';
