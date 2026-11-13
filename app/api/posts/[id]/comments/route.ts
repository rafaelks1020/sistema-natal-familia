import { enviarPush } from '@/app/lib/push';
import { query } from '@/app/lib/db';
import { HttpError, cleanText, ok, readJson, requireUser, route, toInt } from '@/app/lib/api';

// POST /api/posts/[id]/comments { content } -> cria comentário e notifica autor

type ParamsCtx = { params: Promise<{ id: string }> };

export const GET = route<ParamsCtx>(async (_req, { params }) => {
  const me = await requireUser();
  const postId = toInt((await params).id, 'id');
  const post = await query('SELECT id FROM family_posts p WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $2 AND b.blocked_id = p.user_id)', [postId, me.id]);
  if (!post.rows.length) throw new HttpError(404, 'Publicação não encontrada.');
  const { rows } = await query(
    `SELECT id, user_id, user_name, avatar_url, content, created_at, likes, liked_by_me
       FROM (
         SELECT cm.id, cm.user_id, cu.name AS user_name, cu.avatar_url,
                cm.content, cm.created_at,
                (SELECT COUNT(*)::int FROM family_comment_likes WHERE comment_id = cm.id) AS likes,
                EXISTS(SELECT 1 FROM family_comment_likes WHERE comment_id = cm.id AND user_id = $2) AS liked_by_me
           FROM family_post_comments cm
           JOIN family_users cu ON cu.id = cm.user_id
          WHERE cm.post_id = $1
            AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $2 AND b.blocked_id = cm.user_id)
          ORDER BY cm.created_at DESC, cm.id DESC
          LIMIT 200
       ) recentes
      ORDER BY created_at ASC, id ASC`,
    [postId, me.id],
  );
  return ok(rows);
});

export const POST = route<ParamsCtx>(async (req, { params }) => {
  const me = await requireUser();
  const { id } = await params;
  const postId = toInt(id, 'id');

  const body = await readJson<Record<string, unknown>>(req);
  const content = cleanText(body.content, 'o comentário', 600);

  const postRes = await query<{ id: number; user_id: number; bloqueou: boolean }>(
    `SELECT p.id, p.user_id,
            EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = p.user_id AND b.blocked_id = $2) AS bloqueou
       FROM family_posts p
      WHERE p.id = $1
        AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $2 AND b.blocked_id = p.user_id)`,
    [postId, me.id],
  );
  const post = postRes.rows[0];
  if (!post) {
    throw new HttpError(404, 'Publicação não encontrada.');
  }
  if (post.bloqueou) {
    throw new HttpError(403, 'Você não pode interagir com esta publicação.');
  }

  const inserted = await query<{ id: number; created_at: string }>(
    `INSERT INTO family_post_comments (post_id, user_id, content)
     VALUES ($1, $2, $3)
     RETURNING id, created_at`,
    [postId, me.id, content],
  );

  const comment = inserted.rows[0];
  const ownerId = Number(post.user_id);

  if (ownerId !== me.id) {
    await query(
      `INSERT INTO family_notifications (user_id, actor_id, type, post_id, comment_id)
       VALUES ($1, $2, 'post_comment', $3, $4)`,
      [ownerId, me.id, postId, comment.id],
    );
  }

  if (ownerId !== me.id) {
    void enviarPush([ownerId], {
      titulo: 'Novo comentário', corpo: `${me.name} comentou na sua publicação.`, rota: '/mural',
    });
  }

  return ok(
    {
      id: Number(comment.id),
      user_id: me.id,
      user_name: me.name,
      avatar_url: me.avatar_url,
      content,
      created_at: comment.created_at,
      likes: 0,
      liked_by_me: false,
    },
    201,
  );
});
