import { ok, readJson, requireUser, route, toInt } from '@/app/lib/api';
import { desligar, ligar, tipoVinculo } from '../_data';

export const POST = route(async (req) => {
  const me = await requireUser();
  const body = await readJson<Record<string, unknown>>(req);
  await ligar(me.id, toInt(body.pessoa_id, 'a pessoa'), toInt(body.parente_id, 'o parente'), tipoVinculo(body.tipo));
  return ok({ ok: true }, 201);
});

export const DELETE = route(async (req) => {
  const me = await requireUser();
  const body = await readJson<Record<string, unknown>>(req);
  await desligar(me, toInt(body.pessoa_id, 'a pessoa'), toInt(body.parente_id, 'o parente'), tipoVinculo(body.tipo));
  return ok({ ok: true });
});
