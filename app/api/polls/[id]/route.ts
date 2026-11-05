import { query } from '@/app/lib/db';
import { HttpError, ok, requireUser, route, toInt } from '@/app/lib/api';

// DELETE /api/polls/[id] (criador ou admin)

type ParamsCtx = { params: Promise<{ id: string }> };

export const DELETE = route<ParamsCtx>(async (_req, { params }) => {
  const me = await requireUser();
  const { id } = await params;
  const pollId = toInt(id, 'id');

  const existing = await query<{ id: number; created_by: number }>(
    'SELECT id, created_by FROM family_polls WHERE id = $1',
    [pollId],
  );
  const poll = existing.rows[0];
  if (!poll) {
    throw new HttpError(404, 'Enquete não encontrada.');
  }

  if (Number(poll.created_by) !== me.id && !me.is_admin) {
    throw new HttpError(403, 'Sem permissão para apagar esta enquete.');
  }

  await query('DELETE FROM family_polls WHERE id = $1', [pollId]);
  return ok({ ok: true });
});
