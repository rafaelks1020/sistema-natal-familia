import { ok, readJson, requireAdmin, route } from '@/app/lib/api';
import { diaParam, restaurarJanela, salvarJanela } from '@/app/lib/advento';

type Ctx = { params: Promise<{ dia: string }> };

// PUT /api/advento/janelas/:dia: quem organiza grava o conteúdo do dia (vale antes de dezembro).
export const PUT = route<Ctx>(async (req, { params }) => {
  const me = await requireAdmin();
  const { dia } = await params;
  const body = await readJson<Record<string, unknown>>(req);
  return ok(await salvarJanela(me, diaParam(dia), body));
});

// DELETE /api/advento/janelas/:dia: volta ao texto padrão daquele dia.
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const me = await requireAdmin();
  const { dia } = await params;
  return ok(await restaurarJanela(me, diaParam(dia)));
});
