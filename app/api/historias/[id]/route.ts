import { HttpError, ok, readJson, requireUser, route, toInt } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { storyInput } from '@/app/api/receitas/_validation';
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
  const values = storyInput(await readJson<unknown>(req));
  const result = await query(`UPDATE family_stories SET titulo = $4, quem_conta = $5, epoca = $6, audio_url = $7, foto_url = $8, transcricao = $9, duracao_s = $10
    WHERE id = $1 AND ano = $2 AND (user_id = $3 OR $11::boolean) RETURNING id`,
    [id, edicaoAtual(), me.id, ...values, me.is_admin]);
  if (!result.rowCount) throw new HttpError(404, 'Conteúdo não encontrado ou sem permissão para editar.');
  return ok({ id });
});
export const DELETE = route<Context>(async (_req, ctx) => {
  const me = await requireUser();
  const result = await query(`DELETE FROM family_stories WHERE id = $1 AND ano = $2
    AND (user_id = $3 OR $4::boolean) RETURNING id`, [toInt((await ctx.params).id), edicaoAtual(), me.id, me.is_admin]);
  if (!result.rowCount) throw new HttpError(404, 'Conteúdo não encontrado ou sem permissão para apagar.');
  return ok({ ok: true });
});
