import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { comment_id, user_id } = await request.json();

    if (!comment_id || !user_id) {
      return NextResponse.json({ message: 'Dados inválidos' }, { status: 400 });
    }

    const commentId = Number(comment_id);
    const userId = Number(user_id);

    if (!commentId || !userId || Number.isNaN(commentId) || Number.isNaN(userId)) {
      return NextResponse.json({ message: 'Dados inválidos' }, { status: 400 });
    }

    const existing = await query(
      'SELECT id FROM family_comment_likes WHERE comment_id = $1 AND user_id = $2',
      [commentId, userId],
    );

    if (existing.rows.length > 0) {
      await query('DELETE FROM family_comment_likes WHERE id = $1', [existing.rows[0].id]);
      return NextResponse.json({ status: 'removed' });
    }

    await query(
      'INSERT INTO family_comment_likes (comment_id, user_id) VALUES ($1, $2)',
      [commentId, userId],
    );

    // Criar notificação para o dono do comentário (se não for o próprio autor do like)
    try {
      const ownerResult = await query(
        'SELECT user_id FROM family_post_comments WHERE id = $1',
        [commentId],
      );
      const ownerId: number | undefined = ownerResult.rows[0]?.user_id;

      if (ownerId && ownerId !== userId) {
        await query(
          `INSERT INTO family_notifications (user_id, actor_id, type, comment_id)
           VALUES ($1, $2, 'comment_reaction', $3)`,
          [ownerId, userId, commentId],
        );
      }
    } catch (notifyError) {
      console.error('Erro ao registrar notificação de like em comentário:', notifyError);
    }

    return NextResponse.json({ status: 'added' });
  } catch (error) {
    console.error('Erro POST /api/family-comment-likes:', error);
    return NextResponse.json({ message: 'Erro ao registrar like no comentário' }, { status: 500 });
  }
}
