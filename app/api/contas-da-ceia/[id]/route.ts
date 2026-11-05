import { HttpError, ok, requireUser, route, toInt } from '@/app/lib/api';
import { transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { travarContas } from '../_data';
export const DELETE = route<{ params: Promise<{ id: string }> }>(async (_req, ctx) => {
  const me = await requireUser();
  const id = toInt((await ctx.params).id);
  const ano = edicaoAtual();
  await transaction(async q => {
    await travarContas(q, ano);
    const acertos = await q('SELECT 1 FROM ceia_acertos WHERE ano = $1 AND confirmado_em IS NOT NULL LIMIT 1', [ano]);
    if (acertos.rows.length && !me.is_admin) {
      throw new HttpError(409, 'Já tem acerto confirmado: apagar essa despesa mudaria as contas. Peça para quem organiza.');
    }
    const { rowCount } = await q('DELETE FROM ceia_despesas WHERE id = $1 AND ano = $2 AND (user_id = $3 OR $4)', [id, ano, me.id, me.is_admin]);
    if (!rowCount) throw new HttpError(404, 'Despesa não encontrada ou sem permissão.');
    await q("UPDATE content_reports SET resolved_at = NOW() WHERE alvo_tipo = 'ceia_despesa' AND alvo_id = $1 AND resolved_at IS NULL", [id]);
  });
  return ok({ ok: true });
});
