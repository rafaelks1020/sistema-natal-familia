import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import { route, ok, readJson, HttpError, requireAdmin } from '@/app/lib/api';

export const dynamic = 'force-dynamic';

const SLUG = /^[a-z0-9-]{3,120}$/;

/**
 * Estúdio de karaokê (servidor de processamento): devolve um token de cliente do Vercel Blob,
 * restrito a karaoke/<slug>/instrumental.mp3, para o worker subir o instrumental sem ter o token de escrita.
 */
export const POST = route(async (req) => {
  await requireAdmin();
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new HttpError(503, 'Envio de áudio ainda não configurado.');
  const body = await readJson<{ slug?: unknown }>(req);
  const slug = typeof body.slug === 'string' ? body.slug : '';
  if (!SLUG.test(slug)) throw new HttpError(400, 'Slug inválido.');
  const pathname = `karaoke/${slug}/instrumental.mp3`;
  const clientToken = await generateClientTokenFromReadWriteToken({
    token,
    pathname,
    allowedContentTypes: ['audio/mpeg'],
    maximumSizeInBytes: 20 * 1024 * 1024,
    addRandomSuffix: false,
    allowOverwrite: true,
    validUntil: Date.now() + 10 * 60 * 1000,
  });
  return ok({ token: clientToken, pathname });
});
