import { HttpError, ok, readJson, requireAdmin, route, toInt } from '@/app/lib/api';
import { transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { travarContas } from '../../_data';

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, ctx) => {
  await requireAdmin();
  const id = toInt((await ctx.params).id);
  const body = await readJson<{ acao?: unknown } | null>(req);
  if (body?.acao !== 'apagar' && body?.acao !== 'manter') throw new HttpError(400, 'Escolha apagar ou manter.');
  const ano = edicaoAtual();
  await transaction(async q => {
    await travarContas(q, ano);
    const { rows: [denuncia] } = await q<{ alvo_id: number; resolved_at: string | null }>(`SELECT r.alvo_id, r.resolved_at FROM content_reports r
      JOIN ceia_despesas d ON d.id = r.alvo_id WHERE r.id = $1 AND r.alvo_tipo = 'ceia_despesa' AND d.ano = $2 FOR UPDATE OF r`, [id, ano]);
    if (!denuncia) throw new HttpError(404, 'Denúncia não encontrada nesta edição.');
    if (denuncia.resolved_at) return;
    if (body.acao === 'apagar') await q('DELETE FROM ceia_despesas WHERE id = $1 AND ano = $2', [denuncia.alvo_id, ano]);
    await q(`UPDATE content_reports SET resolved_at = NOW() WHERE alvo_tipo = 'ceia_despesa' AND alvo_id = $1 AND resolved_at IS NULL`, [denuncia.alvo_id]);
  });
  return ok({ ok: true });
});
