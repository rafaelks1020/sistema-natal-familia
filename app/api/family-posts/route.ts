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
