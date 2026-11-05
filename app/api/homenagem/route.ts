import { ok, readJson, requireUser, route } from '@/app/lib/api';
import { carregarHomenagem, criarMemorial, fotoOpcional, lerMemorial } from './_data';

export const GET = route(async () => {
  const me = await requireUser();
  return ok(await carregarHomenagem(me));
});

export const POST = route(async (req) => {
  const me = await requireUser();
  const body = await readJson<Record<string, unknown>>(req);
  const id = await criarMemorial(me.id, lerMemorial(body, fotoOpcional(body.foto_url)));
  return ok({ id }, 201);
});
