import { enviarPush } from '@/app/lib/push';
import { transaction } from '@/app/lib/db';
import { HttpError, ok, readJson, requireUser, route, toInt } from '@/app/lib/api';

// POST /api/posts/[id]/reactions { type } -> alterna reação e notifica autor

const ALLOWED_REACTIONS = new Set(['coracao', 'estrela', 'risada', 'brinde']);

type ParamsCtx = { params: Promise<{ id: string }> };

export const POST = route<ParamsCtx>(async (req, { params }) => {
  const me = await requireUser();
  const { id } = await params;
  const postId = toInt(id, 'id');

  const body = await readJson<Record<string, unknown>>(req);
  const type = typeof body.type === 'string' ? body.type.trim() : '';
  if (!ALLOWED_REACTIONS.has(type)) {
    throw new HttpError(400, 'Tipo de reação inválido.');
  }

  let notifyUserId: number | null = null;
  const response = await transaction(async (query) => {
    const postRes = await query<{ id: number; user_id: number }>(
      'SELECT id, user_id FROM family_posts WHERE id = $1 FOR UPDATE',
      [postId],
    );
    const post = postRes.rows[0];
    if (!post) {
      throw new HttpError(404, 'Publicação não encontrada.');
    }

    const removed = await query(
      `DELETE FROM family_post_reactions
        WHERE post_id = $1 AND user_id = $2 AND reaction_type = $3
        RETURNING id`,
      [postId, me.id, type],
    );

    if (removed.rowCount && removed.rowCount > 0) {
      return ok({ status: 'removed', active: false, type });
    }

    await query(
      `INSERT INTO family_post_reactions (post_id, user_id, reaction_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (post_id, user_id, reaction_type) DO NOTHING`,
      [postId, me.id, type],
    );

    const ownerId = Number(post.user_id);
    if (ownerId !== me.id) {
      const notification = await query(
        `INSERT INTO family_notifications (user_id, actor_id, type, post_id, reaction_type)
         SELECT $1, $2, 'post_reaction', $3, $4
         WHERE NOT EXISTS (
           SELECT 1 FROM family_notifications WHERE user_id = $1 AND actor_id = $2
             AND type = 'post_reaction' AND post_id = $3 AND comment_id IS NULL
             AND reaction_type = $4
         )`,
        [ownerId, me.id, postId, type],
      );
      if (notification.rowCount) notifyUserId = ownerId;
    }

    return ok({ status: 'added', active: true, type });
  });
  if (notifyUserId !== null) {
    void enviarPush([notifyUserId], {
      titulo: 'Nova reação', corpo: `${me.name} reagiu à sua publicação.`, rota: '/mural',
    });
  }
  return response;
});
