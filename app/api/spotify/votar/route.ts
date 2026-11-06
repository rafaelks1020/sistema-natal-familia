import { after } from 'next/server';
import { ok, readJson, requireUser, route, toInt } from '@/app/lib/api';
import { reordenar, votar } from '../_service';

/** Curtir ou descurtir uma música. A ordem da playlist no Spotify acompanha os votos, sem atrasar a resposta. */
export const POST = route(async req => {
  const me = await requireUser();
  const body = await readJson<Record<string, unknown>>(req);
  const { momento, ...resultado } = await votar(me, toInt(body?.track_id, 'a música'));
  after(() => reordenar(momento));
  return ok(resultado);
});
