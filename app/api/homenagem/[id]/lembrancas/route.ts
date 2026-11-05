import { cleanText, ok, readJson, requireUser, route, toInt } from '@/app/lib/api';
import { criarLembranca, fotoOpcional } from '../../_data';

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, ctx) => {
  const me = await requireUser();
  const memorialId = toInt((await ctx.params).id);
  const body = await readJson<Record<string, unknown>>(req);
  const id = await criarLembranca(me.id, memorialId, cleanText(body.texto, 'a lembrança', 2000), fotoOpcional(body.image_url));
  return ok({ id }, 201);
});
