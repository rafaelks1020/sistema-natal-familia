import { randomBytes } from 'node:crypto';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import { route, ok, readJson, toInt, HttpError, requireAdmin } from '@/app/lib/api';
import { query } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

const TIPOS = {
  foto: { ext: 'jpg', contentType: 'image/jpeg', max: 4 * 1024 * 1024 },
  clipe: { ext: 'webm', contentType: 'video/webm', max: 30 * 1024 * 1024 },
} as const;

/**
 * Melhores momentos do karaokê: devolve um token de cliente do Vercel Blob restrito a
 * karaoke/momentos/<ano>/<fila_id>/<nome>.(jpg|webm), para o telão enviar a foto ou o clipe direto ao Blob (sem passar pelo servidor).
 * O nome é gerado aqui (tipo, hora e sufixo aleatório), então cada envio tem o seu e nada é sobrescrito.
 */
export const POST = route(async (req) => {
  await requireAdmin();
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new HttpError(503, 'Envio de momentos ainda não configurado.');
  const body = await readJson<{ fila_id?: unknown; tipo?: unknown }>(req);
  const filaId = toInt(body.fila_id, 'fila_id');
  const tipo = body.tipo === 'foto' || body.tipo === 'clipe' ? body.tipo : null;
  if (!tipo) throw new HttpError(400, 'Tipo inválido.');
  const { rows } = await query<{ ano: number }>('SELECT ano FROM karaoke_fila WHERE id = $1', [filaId]);
  if (!rows.length) throw new HttpError(404, 'Música não encontrada na fila.');
  const t = TIPOS[tipo];
  const pathname = `karaoke/momentos/${rows[0].ano}/${filaId}/${tipo}-${Date.now()}-${randomBytes(4).toString('hex')}.${t.ext}`;
  const clientToken = await generateClientTokenFromReadWriteToken({
    token,
    pathname,
    allowedContentTypes: [t.contentType],
    maximumSizeInBytes: t.max,
    addRandomSuffix: false,
    allowOverwrite: false,
    validUntil: Date.now() + 15 * 60 * 1000,
  });
  return ok({ token: clientToken, pathname });
});
