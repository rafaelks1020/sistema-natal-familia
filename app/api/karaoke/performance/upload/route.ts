import { sufixo, urlDeEnvio } from '@/app/lib/arquivos';
import { route, ok, readJson, toInt, HttpError, requireAdmin } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { MAX_BYTES_PERFORMANCE, caminhoPerformance } from '../caminho';

export const dynamic = 'force-dynamic';

/** Rede lenta e arquivo grande (até 400 MB): a URL assinada vale por 30 min. */
const VALIDADE_S = 30 * 60;

/**
 * Apresentação inteira do karaokê: devolve uma URL de envio assinada para
 * karaoke/performances/<ano>/<fila_id>-<sufixo>.webm, para o telão enviar o vídeo direto ao armazenamento (sem passar pela Vercel).
 * O sufixo é aleatório, então cada envio tem o seu e nada é sobrescrito.
 */
export const POST = route(async (req) => {
  await requireAdmin();
  const body = await readJson<{ fila_id?: unknown }>(req);
  const filaId = toInt(body.fila_id, 'fila_id');
  const { rows } = await query<{ ano: number }>('SELECT ano FROM karaoke_fila WHERE id = $1', [filaId]);
  if (!rows.length) throw new HttpError(404, 'Música não encontrada na fila.');
  let pathname: string;
  try { pathname = caminhoPerformance(Number(rows[0].ano), filaId, sufixo()); }
  catch { throw new HttpError(400, 'Não consegui montar o arquivo.'); }
  return ok(urlDeEnvio(pathname, 'video/webm', MAX_BYTES_PERFORMANCE, VALIDADE_S));
});
