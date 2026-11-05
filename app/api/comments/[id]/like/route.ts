import { query } from '@/app/lib/db';
import { HttpError, ok, requireUser, route, toInt } from '@/app/lib/api';

// POST /api/comments/[id]/like -> alterna curtida em comentário

type ParamsCtx = { params: Promise<{ id: string }> };

export const POST = route<ParamsCtx>(async (_req, { params }) => {
  const me = await requireUser();
  const { id } = await params;
  const commentId = toInt(id, 'id');

  const existingComment = await query<{ id: number; user_id: number; post_id: number }>(
    'SELECT id, user_id, post_id FROM family_post_comments WHERE id = $1',
    [commentId],
  );
  const comment = existingComment.rows[0];
  if (!comment) {
    throw new HttpError(404, 'Comentário não encontrado.');
  }

  const removed = await query(
    'DELETE FROM family_comment_likes WHERE comment_id = $1 AND user_id = $2 RETURNING id',
    [commentId, me.id],
  );

  if (removed.rowCount && removed.rowCount > 0) {
    return ok({ status: 'removed', liked: false });
  }

  await query(
    `INSERT INTO family_comment_likes (comment_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (comment_id, user_id) DO NOTHING`,
    [commentId, me.id],
  );

  const ownerId = Number(comment.user_id);
  if (ownerId !== me.id) {
    await query(
      `INSERT INTO family_notifications (user_id, actor_id, type, post_id, comment_id)
       VALUES ($1, $2, 'comment_reaction', $3, $4)`,
      [ownerId, me.id, comment.post_id, commentId],
    );
  }

  return ok({ status: 'added', liked: true });
});
