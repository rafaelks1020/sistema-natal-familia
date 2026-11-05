import { ok, readJson, requireUser, route } from '@/app/lib/api';
import { diaParam, salvarResposta } from '@/app/lib/advento';

type Ctx = { params: Promise<{ dia: string }> };

// POST /api/advento/:dia/resposta { texto, image_url? }
export const POST = route<Ctx>(async (req, { params }) => {
  const me = await requireUser();
  const { dia } = await params;
  const body = await readJson<{ texto?: unknown; image_url?: unknown }>(req);
  return ok(await salvarResposta(me, diaParam(dia), body));
});
