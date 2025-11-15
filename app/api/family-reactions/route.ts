import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { post_id, user_id, reaction_type } = await request.json();

    if (!post_id || !user_id || !reaction_type || !String(reaction_type).trim()) {
      return NextResponse.json({ message: 'Dados inválidos' }, { status: 400 });
    }

    const postId = Number(post_id);
    const userId = Number(user_id);
    const reaction = String(reaction_type).trim();

    // Verificar se já existe essa reação para esse usuário e post
    const existing = await query(
      'SELECT id FROM family_post_reactions WHERE post_id = $1 AND user_id = $2 AND reaction_type = $3',
      [postId, userId, reaction]
    );

    if (existing.rows.length > 0) {
      // Remover reação (toggle off)
      await query('DELETE FROM family_post_reactions WHERE id = $1', [existing.rows[0].id]);
      return NextResponse.json({ status: 'removed' });
    }

    // Adicionar reação (toggle on)
    await query(
      'INSERT INTO family_post_reactions (post_id, user_id, reaction_type) VALUES ($1, $2, $3)',
      [postId, userId, reaction]
    );

    return NextResponse.json({ status: 'added' });
  } catch (error) {
    console.error('Erro POST /api/family-reactions:', error);
    return NextResponse.json({ message: 'Erro ao registrar reação' }, { status: 500 });
  }
}
