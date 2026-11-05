import { ok, requireUser, route } from '@/app/lib/api';
import { diaParam, marcarAberta } from '@/app/lib/advento';

type Ctx = { params: Promise<{ dia: string }> };

// POST /api/advento/:dia/abrir: marca a portinha como aberta por esta pessoa.
export const POST = route<Ctx>(async (_req, { params }) => {
  const me = await requireUser();
  const { dia } = await params;
  return ok(await marcarAberta(me, diaParam(dia)));
});
