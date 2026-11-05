import { ok, readJson, requireUser, route } from '@/app/lib/api';
import { carregarArvore, criarPessoa, fotoOpcional, lerPessoa } from './_data';

export const GET = route(async () => {
  const me = await requireUser();
  return ok(await carregarArvore(me));
});

export const POST = route(async (req) => {
  const me = await requireUser();
  const body = await readJson<Record<string, unknown>>(req);
  const id = await criarPessoa(me.id, lerPessoa(body, fotoOpcional(body.foto_url)));
  return ok({ id }, 201);
});
