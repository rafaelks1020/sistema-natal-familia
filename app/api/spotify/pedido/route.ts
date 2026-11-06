import { HttpError, ok, readJson, requireUser, route, toInt } from '@/app/lib/api';
import { apagarPedido, criarPedido } from '../_service';
import { parseMomento } from '../momentos';

export const POST = route(async req => {
  const me = await requireUser();
  const body = await readJson<Record<string, unknown>>(req);
  const momento = parseMomento(body?.momento);
  if (!momento) throw new HttpError(400, 'Escolha jantar, festa ou amigo oculto.');
  return ok(await criarPedido(me, body?.texto, momento));
});

export const DELETE = route(async req => {
  const me = await requireUser();
  const body = await readJson<Record<string, unknown>>(req);
  return ok(await apagarPedido(me, toInt(body?.id)));
});
