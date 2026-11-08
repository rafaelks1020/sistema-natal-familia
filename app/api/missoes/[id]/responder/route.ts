import { ok, readJson, requireUser, route, toInt } from '@/app/lib/api';
import { responderMissao } from '@/app/lib/gamificacao/painel';

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const me = await requireUser();
  const { id } = await params;
  const missaoId = toInt(id, 'missão');
  const body = await readJson<Record<string, unknown>>(req);
  return ok(await responderMissao(me, missaoId, body), 201);
});
