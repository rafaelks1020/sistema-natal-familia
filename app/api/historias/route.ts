import { ok, readJson, requireUser, route } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { storyInput } from '@/app/api/receitas/_validation';
import { carregar } from './_data';
export const GET = route(async () => {
  const me = await requireUser();
  return ok({ items: await carregar(me.id), ano: edicaoAtual() });
});
export const POST = route(async (req) => {
  const me = await requireUser();
  const values = storyInput(await readJson<unknown>(req));
  const result = await query(`INSERT INTO family_stories (ano, user_id, titulo, quem_conta, epoca, audio_url, foto_url, transcricao, duracao_s)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`, [edicaoAtual(), me.id, ...values]);
  return ok({ id: result.rows[0].id }, 201);
});
