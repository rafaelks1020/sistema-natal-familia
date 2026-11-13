import { enviarPush } from '@/app/lib/push';
import { transaction } from '@/app/lib/db';
import { HttpError, ok, requireUser, route, toInt } from '@/app/lib/api';

// POST /api/comments/[id]/like -> alterna curtida em comentário

type ParamsCtx = { params: Promise<{ id: string }> };

export const POST = route<ParamsCtx>(async (_req, { params }) => {
  const me = await requireUser();
  const { id } = await params;
  const commentId = toInt(id, 'id');

  let notifyUserId: number | null = null;
  const response = await transaction(async (query) => {
    const existingComment = await query<{ id: number; user_id: number; post_id: number; bloqueou: boolean }>(
      `SELECT id, user_id, post_id,
              EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = user_id AND b.blocked_id = $2) AS bloqueou
         FROM family_post_comments WHERE id = $1 FOR UPDATE`,
      [commentId, me.id],
    );
    const comment = existingComment.rows[0];
    if (!comment) {
      throw new HttpError(404, 'Comentário não encontrado.');
    }
    if (comment.bloqueou) {
      throw new HttpError(403, 'Você não pode interagir com esta publicação.');
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
      const notification = await query(
        `INSERT INTO family_notifications (user_id, actor_id, type, post_id, comment_id)
         SELECT $1, $2, 'comment_reaction', $3, $4
         WHERE NOT EXISTS (
           SELECT 1 FROM family_notifications WHERE user_id = $1 AND actor_id = $2
             AND type = 'comment_reaction' AND post_id = $3 AND comment_id = $4
             AND reaction_type IS NULL
         )`,
        [ownerId, me.id, comment.post_id, commentId],
      );
      if (notification.rowCount) notifyUserId = ownerId;
    }

    return ok({ status: 'added', liked: true });
  });
  if (notifyUserId !== null) {
    void enviarPush([notifyUserId], {
      titulo: 'Nova curtida', corpo: `${me.name} curtiu seu comentário.`, rota: '/mural',
    });
  }
  return response;
});
