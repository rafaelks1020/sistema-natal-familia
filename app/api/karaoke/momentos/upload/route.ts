import { randomBytes } from 'node:crypto';
import { urlDeEnvio } from '@/app/lib/arquivos';
import { route, ok, readJson, toInt, HttpError, requireAdmin } from '@/app/lib/api';
import { query } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

const TIPOS = {
  foto: { ext: 'jpg', contentType: 'image/jpeg', max: 4 * 1024 * 1024 },
  clipe: { ext: 'webm', contentType: 'video/webm', max: 30 * 1024 * 1024 },
} as const;

/**
 * Melhores momentos do karaokê: devolve uma URL de envio assinada para
 * karaoke/momentos/<ano>/<fila_id>/<nome>.(jpg|webm), para o telão enviar a foto ou o clipe direto ao armazenamento (sem passar pela Vercel).
 * O nome é gerado aqui (tipo, hora e sufixo aleatório), então cada envio tem o seu e nada é sobrescrito.
 */
export const POST = route(async (req) => {
  await requireAdmin();
  const body = await readJson<{ fila_id?: unknown; tipo?: unknown }>(req);
  const filaId = toInt(body.fila_id, 'fila_id');
  const tipo = body.tipo === 'foto' || body.tipo === 'clipe' ? body.tipo : null;
  if (!tipo) throw new HttpError(400, 'Tipo inválido.');
  const { rows } = await query<{ ano: number }>('SELECT ano FROM karaoke_fila WHERE id = $1', [filaId]);
  if (!rows.length) throw new HttpError(404, 'Música não encontrada na fila.');
  const t = TIPOS[tipo];
  const pathname = `karaoke/momentos/${rows[0].ano}/${filaId}/${tipo}-${Date.now()}-${randomBytes(4).toString('hex')}.${t.ext}`;
  return ok(urlDeEnvio(pathname, t.contentType, t.max));
});
