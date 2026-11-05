import { ok, readJson, requireUser, route } from '@/app/lib/api';
import { diaParam, votar } from '@/app/lib/advento';

type Ctx = { params: Promise<{ dia: string }> };

// POST /api/advento/:dia/voto { opcao }
export const POST = route<Ctx>(async (req, { params }) => {
  const me = await requireUser();
  const { dia } = await params;
  const body = await readJson<{ opcao?: unknown }>(req);
  return ok(await votar(me, diaParam(dia), body.opcao));
});
