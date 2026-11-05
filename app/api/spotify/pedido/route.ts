import { ok, readJson, requireUser, route, toInt } from '@/app/lib/api';
import { apagarPedido, criarPedido } from '../_service';

export const POST = route(async req => {
  const me = await requireUser();
  const body = await readJson<Record<string, unknown>>(req);
  return ok(await criarPedido(me, body?.texto));
});

export const DELETE = route(async req => {
  const me = await requireUser();
  const body = await readJson<Record<string, unknown>>(req);
  return ok(await apagarPedido(me, toInt(body?.id)));
});
