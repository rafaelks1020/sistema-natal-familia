import { sufixo, urlDeEnvio } from '@/app/lib/arquivos';
import { route, ok, readJson, HttpError, requireAdmin, toInt } from '@/app/lib/api';

export const dynamic = 'force-dynamic';

/**
 * Melhores momentos do karaokê (servidor de processamento): devolve uma URL de envio assinada para
 * karaoke/reels/<ano>/<fila_id>-<sufixo>.mp4 (nome novo a cada envio: o cache dos arquivos é imutável).
 */
export const POST = route(async (req) => {
  await requireAdmin();
  const body = await readJson<{ filaId?: unknown; ano?: unknown }>(req);
  const filaId = toInt(body.filaId, 'filaId');
  const ano = toInt(body.ano, 'ano');
  if (ano < 2000 || ano > 2100) throw new HttpError(400, 'Ano inválido.');
  return ok(urlDeEnvio(`karaoke/reels/${ano}/${filaId}-${Date.now()}-${sufixo()}.mp4`, 'video/mp4', 100 * 1024 * 1024, 10 * 60));
});
