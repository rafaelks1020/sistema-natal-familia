import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export async function GET() {
  try {
    const { rows } = await query(
      `SELECT 
         p.id,
         p.user_id,
         p.content,
         p.image_url,
         p.created_at,
         u.name as user_name,
         COALESCE(r.reactions, '{}'::jsonb) as reactions,
         COALESCE(c.comments, '[]'::jsonb) as comments
       FROM family_posts p
       JOIN family_users u ON u.id = p.user_id
       LEFT JOIN LATERAL (
         SELECT jsonb_object_agg(reaction_type, count) as reactions
         FROM (
           SELECT reaction_type, COUNT(*) as count
           FROM family_post_reactions
           WHERE post_id = p.id
           GROUP BY reaction_type
         ) x
       ) r ON TRUE
       LEFT JOIN LATERAL (
         SELECT jsonb_agg(
           jsonb_build_object(
             'id', c.id,
             'user_id', c.user_id,
             'user_name', u2.name,
             'content', c.content,
             'created_at', c.created_at
           )
           ORDER BY c.created_at ASC
         ) as comments
         FROM family_post_comments c
         JOIN family_users u2 ON u2.id = c.user_id
         WHERE c.post_id = p.id
       ) c ON TRUE
       ORDER BY p.created_at DESC
       LIMIT 100`
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Erro GET /api/family-posts:', error);
    return NextResponse.json({ message: 'Erro ao carregar mural' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    if (!data.user_id || !data.content || !String(data.content).trim()) {
      return NextResponse.json({ message: 'Dados inválidos' }, { status: 400 });
    }

    const postResult = await query(
      `INSERT INTO family_posts (user_id, content, image_url)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, content, image_url, created_at`,
      [data.user_id, String(data.content).trim(), data.image_url || null]
    );

    const post = postResult.rows[0];
    const userResult = await query('SELECT name FROM family_users WHERE id = $1', [post.user_id]);
    const userName = userResult.rows[0]?.name || 'Família';

    return NextResponse.json({ ...post, user_name: userName }, { status: 201 });
  } catch (error) {
    console.error('Erro POST /api/family-posts:', error);
    return NextResponse.json({ message: 'Erro ao criar post' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    const postId = Number(data.id);
    const userId = Number(data.user_id);
    const text = String(data.content || '').trim();

    if (!postId || !userId || !text) {
      return NextResponse.json({ message: 'Dados inválidos' }, { status: 400 });
    }

    const updateResult = await query(
      `UPDATE family_posts
         SET content = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, user_id, content, image_url, created_at`,
      [text, postId, userId],
    );

    const post = updateResult.rows[0];
    if (!post) {
      return NextResponse.json({ message: 'Post não encontrado ou não autorizado' }, { status: 403 });
    }

    const userResult = await query('SELECT name FROM family_users WHERE id = $1', [post.user_id]);
    const userName = userResult.rows[0]?.name || 'Família';

    return NextResponse.json({ ...post, user_name: userName });
  } catch (error) {
    console.error('Erro PUT /api/family-posts:', error);
    return NextResponse.json({ message: 'Erro ao atualizar post' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const data = await request.json();
    const postId = Number(data.id);
    const userId = Number(data.user_id);

    if (!postId || !userId) {
      return NextResponse.json({ message: 'Dados inválidos' }, { status: 400 });
    }

    const deleteResult = await query('DELETE FROM family_posts WHERE id = $1 AND user_id = $2 RETURNING id', [
      postId,
      userId,
    ]);

    if (deleteResult.rowCount === 0) {
      return NextResponse.json({ message: 'Post não encontrado ou não autorizado' }, { status: 403 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro DELETE /api/family-posts:', error);
    return NextResponse.json({ message: 'Erro ao apagar post' }, { status: 500 });
  }
}
