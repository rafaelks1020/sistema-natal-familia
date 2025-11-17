import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get('user_id');
    const userId = userIdParam ? Number(userIdParam) : NaN;

    if (!userId || Number.isNaN(userId)) {
      return NextResponse.json({ message: 'user_id obrigatório' }, { status: 400 });
    }

    const { rows } = await query(
      `SELECT 
         n.id,
         n.type,
         n.post_id,
         n.comment_id,
         n.reaction_type,
         n.created_at,
         n.read_at,
         actor.name AS actor_name,
         p.content AS post_content
       FROM family_notifications n
       JOIN family_users actor ON actor.id = n.actor_id
       LEFT JOIN family_posts p ON p.id = n.post_id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 30`,
      [userId],
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Erro GET /api/family-notifications:', error);
    return NextResponse.json({ message: 'Erro ao carregar notificações' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, user_id, notification_ids } = body as {
      action?: string;
      user_id?: number | string;
      notification_ids?: number[];
    };

    const userId = user_id ? Number(user_id) : NaN;

    if (!action || !userId || Number.isNaN(userId)) {
      return NextResponse.json({ message: 'Parâmetros inválidos' }, { status: 400 });
    }

    if (action === 'mark_all_read') {
      await query('UPDATE family_notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL', [
        userId,
      ]);
      return NextResponse.json({ success: true });
    }

    if (action === 'mark_read' && Array.isArray(notification_ids) && notification_ids.length > 0) {
      await query(
        'UPDATE family_notifications SET read_at = NOW() WHERE user_id = $1 AND id = ANY($2::int[])',
        [userId, notification_ids],
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ message: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    console.error('Erro POST /api/family-notifications:', error);
    return NextResponse.json({ message: 'Erro ao atualizar notificações' }, { status: 500 });
  }
}
