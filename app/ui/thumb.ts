import { ehArquivoNosso } from '@/app/lib/hosts-arquivos';

// Sem 'use client': serve tanto para componente do servidor quanto do navegador.
/**
 * Miniatura de foto do Blob pelo otimizador da Vercel (AVIF/WebP no tamanho pedido).
 * Larguras válidas: 96, 160, 256, 384, 640, 828, 1080, 1280 (next.config.ts).
 * Foto de fora do Blob volta como está.
 */
export function thumb(url: string | null | undefined, largura: 96 | 160 | 256 | 384 | 640 | 828 | 1080 | 1280 = 828, q = 72): string {
  if (!url) return '';
  if (!ehArquivoNosso(url)) return url;
  return `/_next/image?url=${encodeURIComponent(url)}&w=${largura}&q=${q}`;
}
