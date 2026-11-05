import { ok, readJson, requireAdmin, route } from '@/app/lib/api';
import { apagar, editar, lerId, recursoDisponivel } from '@/app/lib/admin/consulta';

type Context = { params: Promise<{ recurso: string; id: string }> };

// PATCH /api/admin/r/<recurso>/<id> { campo: valor } -> só campos editáveis do recurso.
export const PATCH = route<Context>(async (req, { params }) => {
  const me = await requireAdmin();
  const { recurso, id } = await params;
  const r = await recursoDisponivel(recurso);
  const item = await editar(r, lerId(r, id), await readJson(req), me);
  return ok({ ok: true, item });
});

export const DELETE = route<Context>(async (_req, { params }) => {
  const me = await requireAdmin();
  const { recurso, id } = await params;
  const r = await recursoDisponivel(recurso);
  await apagar(r, lerId(r, id), me);
  return ok({ ok: true });
});
