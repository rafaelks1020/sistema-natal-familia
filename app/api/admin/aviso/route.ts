import { cleanText, HttpError, ok, readJson, requireAdmin, route } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { enviarPush } from '@/app/lib/push';
import { registrarSemFalhar } from '@/app/lib/admin/consulta';

// POST /api/admin/aviso { titulo, corpo, rota?, user_ids? } -> { ok, enviados }
// Sem user_ids, vai para todo mundo que tem o app com avisos ligados. `enviados` = pessoas com aparelho ativo.
export const POST = route(async (req) => {
  const me = await requireAdmin();
  const body = await readJson<Record<string, unknown>>(req);
  const titulo = cleanText(body.titulo, 'o título', 80);
  const corpo = cleanText(body.corpo, 'a mensagem', 240);
  let rota: string | undefined;
  if (body.rota !== undefined && body.rota !== null && body.rota !== '') {
    if (typeof body.rota !== 'string' || !/^\/[A-Za-z0-9\-_/]{0,100}$/.test(body.rota) || body.rota.startsWith('//')) {
      throw new HttpError(400, 'A tela de destino precisa começar com / (por exemplo /mural).');
    }
    rota = body.rota;
  }
  let ids: number[] | null = null;
  if (body.user_ids !== undefined && body.user_ids !== null) {
    if (!Array.isArray(body.user_ids) || body.user_ids.length > 500) throw new HttpError(400, 'Lista de pessoas inválida.');
    ids = [...new Set(body.user_ids.map((v) => Number(v)))];
    if (ids.some((n) => !Number.isInteger(n) || n <= 0)) throw new HttpError(400, 'Lista de pessoas inválida.');
  }
  const { rows } = await query<{ user_id: number }>(
    `SELECT DISTINCT d.user_id FROM push_devices d
      WHERE d.disabled_at IS NULL AND ($1::int[] IS NULL OR d.user_id = ANY($1::int[]))`,
    [ids],
  );
  const destino = rows.map((r) => r.user_id);
  if (destino.length) await enviarPush(destino, { titulo, corpo, ...(rota ? { rota } : {}) });
  await registrarSemFalhar(me, 'enviar_aviso', 'aviso', null,
    `"${titulo}" para ${ids ? `${ids.length} pessoa(s) escolhida(s)` : 'todos'}; ${destino.length} com aparelho ativo`);
  return ok({ ok: true, enviados: destino.length });
});
