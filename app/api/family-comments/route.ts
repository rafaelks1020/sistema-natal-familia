import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { post_id, user_id, content } = await request.json();

    if (!post_id || !user_id || !content || !String(content).trim()) {
      return NextResponse.json({ message: 'Dados inválidos' }, { status: 400 });
    }

    const postId = Number(post_id);
    const userId = Number(user_id);
    const text = String(content).trim();

    const insertResult = await query(
      `INSERT INTO family_post_comments (post_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [postId, userId, text],
    );

    const commentId: number | undefined = insertResult.rows[0]?.id;

    // Criar notificação para o dono do post (se não for o próprio autor do comentário)
    try {
      const postOwnerResult = await query('SELECT user_id FROM family_posts WHERE id = $1', [postId]);
      const postOwnerId: number | undefined = postOwnerResult.rows[0]?.user_id;

      if (postOwnerId && postOwnerId !== userId && commentId) {
        await query(
          `INSERT INTO family_notifications (user_id, actor_id, type, post_id, comment_id)
           VALUES ($1, $2, 'post_comment', $3, $4)`,
          [postOwnerId, userId, postId, commentId],
        );
      }
    } catch (notifyError) {
      // Não quebra o fluxo se falhar a notificação; apenas loga
      console.error('Erro ao registrar notificação de comentário no mural:', notifyError);
    }

    return NextResponse.json({ success: true, comment_id: commentId });
  } catch (error) {
    console.error('Erro POST /api/family-comments:', error);
    return NextResponse.json({ message: 'Erro ao criar comentário' }, { status: 500 });
  }
}
