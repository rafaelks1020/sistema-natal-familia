'use client';

// Cliente das rotas /api: devolve o JSON ou lança ErroApi com a mensagem do servidor.
// 401 manda para /entrar (sessão expirou). Passou de 20 s sem resposta, desiste com aviso.
// 403 da proteção da Vercel (x-vercel-mitigated) recarrega a página uma vez por minuto:
// só o navegador resolve o desafio, e só ao recarregar.

export class ErroApi extends Error {
  status: number;
  bloqueio: boolean;
  constructor(message: string, status: number, bloqueio = false) {
    super(message);
    this.name = 'ErroApi';
    this.status = status;
    this.bloqueio = bloqueio;
  }
}

const TIMEOUT_PADRAO_MS = 20_000;
const CHAVE_RECARGA_BLOQUEIO = 'natal:recarga-bloqueio';

function recarregarPorBloqueio() {
  if (typeof window === 'undefined') return;
  try {
    const ultima = Number(window.sessionStorage.getItem(CHAVE_RECARGA_BLOQUEIO) || 0);
    if (Date.now() - ultima < 60_000) return;
    window.sessionStorage.setItem(CHAVE_RECARGA_BLOQUEIO, String(Date.now()));
    window.location.reload();
  } catch {
    /* sem sessionStorage: não recarrega para não entrar em laço */
  }
}

export async function api<T = any>(
  path: string,
  init?: RequestInit & { json?: unknown; timeoutMs?: number },
): Promise<T> {
  const { json, headers, timeoutMs = TIMEOUT_PADRAO_MS, signal: sinalDeFora, ...rest } = init ?? {};
  const controle = new AbortController();
  let estourou = false;
  const timer = setTimeout(() => {
    estourou = true;
    controle.abort();
  }, timeoutMs);
  const repassar = () => controle.abort(sinalDeFora?.reason);
  if (sinalDeFora) {
    if (sinalDeFora.aborted) repassar();
    else sinalDeFora.addEventListener('abort', repassar, { once: true });
  }
  try {
    const res = await fetch(path, {
      ...rest,
      signal: controle.signal,
      headers: json !== undefined ? { 'Content-Type': 'application/json', ...headers } : headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      cache: 'no-store',
    });
    let data: any = null;
    let leuJson = true;
    try {
      data = await res.json();
    } catch (e) {
      if (estourou) throw e;
      leuJson = false;
    }
    if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/api/auth')) {
      window.location.href = '/entrar';
    }
    if (!res.ok) {
      const bloqueio = res.status === 403 && res.headers.has('x-vercel-mitigated');
      if (bloqueio) {
        recarregarPorBloqueio();
        throw new ErroApi('A proteção do servidor pediu uma checagem. Tente de novo em instantes.', 403, true);
      }
      const msg = data?.error || (leuJson ? 'Não deu certo. Tente de novo.' : 'O servidor não respondeu direito. Tente de novo em instantes.');
      throw new ErroApi(msg, res.status);
    }
    return data as T;
  } catch (e) {
    if (estourou) throw new ErroApi('Demorou demais. Confira a internet e tente de novo.', 0);
    throw e;
  } finally {
    clearTimeout(timer);
    sinalDeFora?.removeEventListener('abort', repassar);
  }
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

// A Vercel corta o corpo em 4,5 MB: recusa antes, com aviso claro.
const LIMITE_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Envia uma foto para /api/upload (já comprimida) e devolve a URL pública. */
export async function uploadImage(file: File): Promise<string> {
  const pronta = await comprimir(file);
  if (pronta.size > LIMITE_UPLOAD_BYTES) throw new ErroApi('Essa foto é grande demais (máximo 4 MB). Tente outra foto.', 413);
  const form = new FormData();
  form.append('file', pronta);
  const { url } = await api<{ url: string }>('/api/upload', { method: 'POST', body: form, timeoutMs: 60_000 });
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
