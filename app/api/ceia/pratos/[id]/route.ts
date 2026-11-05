import { HttpError, ok, readJson, requireUser, route, toInt } from '@/app/lib/api';
import { query, transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { carregarPratos } from '../../dados';

type Ctx = { params: Promise<{ id: string }> };

async function pratoVisivel(id: number, userId: number, ano: number) {
  const { rows } = await query<{ id: number; user_id: number; responsavel_id: number | null; bloqueado: boolean }>(
    `SELECT d.id, d.user_id, d.responsavel_id,
            EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $3 AND b.blocked_id = d.user_id) AS bloqueado
       FROM ceia_dishes d
      WHERE d.id = $1 AND d.ano = $2`,
    [id, ano, userId],
  );
  return rows[0] ?? null;
}

export const POST = route<Ctx>(async (req, { params }) => {
  const me = await requireUser();
  const { id: bruto } = await params;
  const id = toInt(bruto, 'id');
  const body = await readJson<Record<string, unknown>>(req);
  const acao = body.acao;
  if (acao !== 'assumir' && acao !== 'desistir') throw new HttpError(400, 'Escolha assumir ou desistir.');
  const ano = edicaoAtual();

  if (acao === 'desistir') {
    const atualizado = await query(
      `UPDATE ceia_dishes SET responsavel_id = NULL
        WHERE id = $1 AND ano = $2 AND responsavel_id = $3`,
      [id, ano, me.id],
    );
    if (!atualizado.rowCount) throw new HttpError(400, 'Você não está levando este item.');
  } else {
    await transaction(async (q) => {
      const { rows } = await q<{ id: number; user_id: number; responsavel_id: number | null; bloqueado: boolean }>(
        `SELECT d.id, d.user_id, d.responsavel_id,
                EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $3 AND b.blocked_id = d.user_id) AS bloqueado
           FROM ceia_dishes d
          WHERE d.id = $1 AND d.ano = $2
          FOR UPDATE`,
        [id, ano, me.id],
      );
      const prato = rows[0];
      if (!prato || prato.bloqueado) throw new HttpError(404, 'Item não encontrado.');
      if (prato.responsavel_id) throw new HttpError(400, 'Alguém já vai levar este item.');
      await q('UPDATE ceia_dishes SET responsavel_id = $2 WHERE id = $1', [id, me.id]);
    });
  }

  const [prato] = await carregarPratos(me, ano, id);
  if (!prato) throw new HttpError(404, 'Item não encontrado.');
  return ok(prato);
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const me = await requireUser();
  const { id: bruto } = await params;
  const id = toInt(bruto, 'id');
  const ano = edicaoAtual();
  const prato = await pratoVisivel(id, me.id, ano);
  if (!prato || (prato.bloqueado && prato.user_id !== me.id && !me.is_admin)) {
    throw new HttpError(404, 'Item não encontrado.');
  }
  if (prato.user_id !== me.id && !me.is_admin) {
    throw new HttpError(403, 'Só quem criou o item, ou quem organiza, pode apagar.');
  }
  await query('DELETE FROM ceia_dishes WHERE id = $1 AND ano = $2', [id, ano]);
  return ok({ ok: true });
});
