import { ok, requireUser, route, toInt } from '@/app/lib/api';
import { apagarResposta } from '@/app/lib/advento';

type Ctx = { params: Promise<{ id: string }> };

// DELETE /api/advento/respostas/:id (autor ou organizador)
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const me = await requireUser();
  const { id } = await params;
  return ok(await apagarResposta(me, toInt(id, 'id')));
});
