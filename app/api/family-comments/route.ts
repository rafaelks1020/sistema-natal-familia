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

    await query(
      `INSERT INTO family_post_comments (post_id, user_id, content)
       VALUES ($1, $2, $3)`,
      [postId, userId, text]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro POST /api/family-comments:', error);
    return NextResponse.json({ message: 'Erro ao criar comentário' }, { status: 500 });
  }
}
