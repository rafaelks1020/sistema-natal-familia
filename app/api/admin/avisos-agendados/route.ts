import { ok, readJson, requireAdmin, route } from '@/app/lib/api';
import { criarAviso, listarAvisos } from '@/app/lib/admin/avisos';

export const GET = route(async () => {
  await requireAdmin();
  const resposta = ok(await listarAvisos());
  resposta.headers.set('Cache-Control', 'no-store');
  return resposta;
});

export const POST = route(async (req) => {
  const me = await requireAdmin();
  const aviso = await criarAviso(me, await readJson<Record<string, unknown>>(req));
  return ok({ aviso }, 201);
});
