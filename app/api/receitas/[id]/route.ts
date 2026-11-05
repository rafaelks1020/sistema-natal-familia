import { HttpError, ok, readJson, requireUser, route, toInt } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { recipeInput } from '@/app/api/receitas/_validation';
import { carregar } from '../_data';
type Context = { params: Promise<{ id: string }> };
export const GET = route<Context>(async (_req, ctx) => {
  const me = await requireUser();
  const [item] = await carregar(me.id, toInt((await ctx.params).id));
  if (!item) throw new HttpError(404, 'Conteúdo não encontrado.');
  return ok(item);
});
export const PATCH = route<Context>(async (req, ctx) => {
  const me = await requireUser();
  const id = toInt((await ctx.params).id);
  const values = recipeInput(await readJson<unknown>(req));
  const result = await query(`UPDATE family_recipes SET titulo = $4, de_quem = $5, categoria = $6, foto_url = $7, ingredientes = $8, modo_preparo = $9, segredo = $10, audio_url = $11, updated_at = NOW()
    WHERE id = $1 AND ano = $2 AND (user_id = $3 OR $12::boolean) RETURNING id`,
    [id, edicaoAtual(), me.id, ...values, me.is_admin]);
  if (!result.rowCount) throw new HttpError(404, 'Conteúdo não encontrado ou sem permissão para editar.');
  return ok({ id });
});
export const DELETE = route<Context>(async (_req, ctx) => {
  const me = await requireUser();
  const result = await query(`DELETE FROM family_recipes WHERE id = $1 AND ano = $2
    AND (user_id = $3 OR $4::boolean) RETURNING id`, [toInt((await ctx.params).id), edicaoAtual(), me.id, me.is_admin]);
  if (!result.rowCount) throw new HttpError(404, 'Conteúdo não encontrado ou sem permissão para apagar.');
  return ok({ ok: true });
});
