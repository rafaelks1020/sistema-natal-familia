import { query } from '@/app/lib/db';
import { HttpError, ok, requireUser, route, toInt } from '@/app/lib/api';

// DELETE /api/comments/[id] (autor ou admin)

type ParamsCtx = { params: Promise<{ id: string }> };

export const DELETE = route<ParamsCtx>(async (_req, { params }) => {
  const me = await requireUser();
  const { id } = await params;
  const commentId = toInt(id, 'id');

  const existing = await query<{ id: number; user_id: number }>(
    'SELECT id, user_id FROM family_post_comments WHERE id = $1',
    [commentId],
  );
  const comment = existing.rows[0];
  if (!comment) {
    throw new HttpError(404, 'Comentário não encontrado.');
  }

  if (Number(comment.user_id) !== me.id && !me.is_admin) {
    throw new HttpError(403, 'Sem permissão para apagar este comentário.');
  }

  await query('DELETE FROM family_post_comments WHERE id = $1', [commentId]);
  return ok({ ok: true });
});
