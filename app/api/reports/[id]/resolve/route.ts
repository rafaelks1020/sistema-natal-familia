import { transaction } from '@/app/lib/db';
import { HttpError, ok, readJson, requireAdmin, route, toInt } from '@/app/lib/api';

type Context = { params: Promise<{ id: string }> };
export const POST = route<Context>(async (req, { params }) => {
  await requireAdmin();
  const id = toInt((await params).id);
  const { acao } = await readJson<Record<string, unknown>>(req);
  if (acao !== 'apagar' && acao !== 'manter') throw new HttpError(400, 'Escolha apagar ou manter.');
  await transaction(async (q) => {
    // Evita duas resoluções concorrentes apagando denúncias do mesmo conteúdo em cascata.
    await q('SELECT pg_advisory_xact_lock(7214)');
    const { rows } = await q('SELECT post_id, comment_id, resolved_at FROM content_reports WHERE id = $1 FOR UPDATE', [id]);
    const report = rows[0];
    if (!report) throw new HttpError(404, 'Denúncia não encontrada.');
    if (report.resolved_at) return;
    await q('UPDATE content_reports SET resolved_at = NOW() WHERE id = $1', [id]);
    if (acao === 'apagar') {
      if (report.comment_id) await q('DELETE FROM family_post_comments WHERE id = $1', [report.comment_id]);
      else await q('DELETE FROM family_posts WHERE id = $1', [report.post_id]);
    }
  });
  return ok({ ok: true });
});
