import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import { route, ok, readJson, HttpError, requireAdmin, toInt } from '@/app/lib/api';

export const dynamic = 'force-dynamic';

/**
 * Melhores momentos do karaokê (servidor de processamento): devolve um token de cliente do Vercel Blob,
 * restrito a karaoke/reels/<ano>/<fila_id>.mp4, para o worker subir o vídeo sem ter o token de escrita.
 */
export const POST = route(async (req) => {
  await requireAdmin();
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new HttpError(503, 'Envio de vídeo ainda não configurado.');
  const body = await readJson<{ filaId?: unknown; ano?: unknown }>(req);
  const filaId = toInt(body.filaId, 'filaId');
  const ano = toInt(body.ano, 'ano');
  if (ano < 2000 || ano > 2100) throw new HttpError(400, 'Ano inválido.');
  const pathname = `karaoke/reels/${ano}/${filaId}.mp4`;
  const clientToken = await generateClientTokenFromReadWriteToken({
    token,
    pathname,
    allowedContentTypes: ['video/mp4'],
    maximumSizeInBytes: 100 * 1024 * 1024,
    addRandomSuffix: false,
    allowOverwrite: true,
    validUntil: Date.now() + 10 * 60 * 1000,
  });
  return ok({ token: clientToken, pathname });
});
