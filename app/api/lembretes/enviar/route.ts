import { HttpError, ok, readJson, requireAdmin, route, toInt } from '@/app/lib/api';
import { enviarLembrete, type MotivoLembrete } from '@/app/lib/lembretes';

// Manda agora. Respeita o limite de 1 por dia por pessoa e motivo, e só atinge quem está na ficha.
export const POST = route(async (req) => {
  await requireAdmin();
  const body = await readJson(req);
  const motivo = body.motivo;
  if (motivo !== 'presenca' && motivo !== 'vaquinha') throw new HttpError(400, 'Motivo inválido.');
  let userIds: number[] | undefined;
  if (body.user_ids !== undefined && body.user_ids !== null) {
    if (!Array.isArray(body.user_ids) || body.user_ids.length > 500) throw new HttpError(400, 'Lista de pessoas inválida.');
    userIds = [...new Set(body.user_ids.map((id) => toInt(id, 'user_ids')))];
  }
  const r = await enviarLembrete(motivo as MotivoLembrete, { userIds, intervaloDias: 1 });
  return ok({ ...r, ja_avisados: r.elegiveis - r.enviados });
});
