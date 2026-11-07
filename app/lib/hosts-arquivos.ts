// Sem 'server-only': usado no servidor e no navegador. Endereços de onde aceitamos fotos e arquivos (os nossos).
// Storage Box da Hetzner (novo, tudo que é grande vai para lá) e o Vercel Blob (arquivos antigos, até a migração terminar).
export const HOST_ARQUIVOS = 'arquivos.natalemfamilia.com.br';
const HOST_ANTIGO = 'natal.169-58-196-17.sslip.io';

/** URL de arquivo enviado pelo nosso sistema? (Link de outro site serviria de "pixel" para rastrear quem abre.) */
export function ehArquivoNosso(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:') return false;
    return u.hostname.endsWith('.public.blob.vercel-storage.com') || ((u.hostname === HOST_ARQUIVOS || u.hostname === HOST_ANTIGO) && u.pathname.startsWith('/f/'));
  } catch {
    return false;
  }
}
