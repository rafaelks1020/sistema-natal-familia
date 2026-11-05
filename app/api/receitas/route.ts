import { ok, readJson, requireUser, route } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { recipeInput } from '@/app/api/receitas/_validation';
import { carregar } from './_data';
export const GET = route(async () => {
  const me = await requireUser();
  return ok({ items: await carregar(me.id), ano: edicaoAtual() });
});
export const POST = route(async (req) => {
  const me = await requireUser();
  const values = recipeInput(await readJson<unknown>(req));
  const result = await query(`INSERT INTO family_recipes (ano, user_id, titulo, de_quem, categoria, foto_url, ingredientes, modo_preparo, segredo, audio_url)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`, [edicaoAtual(), me.id, ...values]);
  return ok({ id: result.rows[0].id }, 201);
});
