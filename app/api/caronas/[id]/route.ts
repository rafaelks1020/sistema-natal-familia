import { HttpError, ok, readJson, requireUser, route, toInt } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
type Context = { params: Promise<{ id: string }> };
export const PATCH = route<Context>(async (req, ctx) => {
  const me = await requireUser();
  const id = toInt((await ctx.params).id);
  const body = await readJson<{ ativo?: unknown } | null>(req);
  if (typeof body?.ativo !== 'boolean') throw new HttpError(400, 'Informe se o anúncio está ativo.');
  const { rowCount } = await query('UPDATE ride_offers SET ativo = $1 WHERE id = $2 AND ano = $3 AND (user_id = $4 OR $5)', [body.ativo, id, edicaoAtual(), me.id, me.is_admin]);
  if (!rowCount) throw new HttpError(404, 'Anúncio não encontrado ou sem permissão.');
  return ok({ ok: true });
});
export const DELETE = route<Context>(async (_req, ctx) => {
  const me = await requireUser();
  const { rowCount } = await query('DELETE FROM ride_offers WHERE id = $1 AND ano = $2 AND (user_id = $3 OR $4)', [toInt((await ctx.params).id), edicaoAtual(), me.id, me.is_admin]);
  if (!rowCount) throw new HttpError(404, 'Anúncio não encontrado ou sem permissão.');
  return ok({ ok: true });
});
