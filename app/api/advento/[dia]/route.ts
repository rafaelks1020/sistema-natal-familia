import { ok, requireUser, route } from '@/app/lib/api';
import { carregarDia, diaParam } from '@/app/lib/advento';

type Ctx = { params: Promise<{ dia: string }> };

// GET /api/advento/:dia: conteúdo, respostas (sem bloqueados) e votos. Fechada: 403, sem conteúdo.
export const GET = route<Ctx>(async (_req, { params }) => {
  const me = await requireUser();
  const { dia } = await params;
  return ok(await carregarDia(me, diaParam(dia)));
});
