import { ok, readJson, requireAdmin, route } from '@/app/lib/api';
import { criarMissaoAdmin } from '@/app/lib/gamificacao/painel';

export const POST = route(async (req) => {
  const me = await requireAdmin();
  const body = await readJson<Record<string, unknown>>(req);
  return ok(await criarMissaoAdmin(me, body), 201);
});
