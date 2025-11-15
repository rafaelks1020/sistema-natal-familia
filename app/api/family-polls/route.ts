import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

export async function GET() {
  try {
    const { rows } = await query(
      `SELECT 
         p.id,
         p.question,
         p.options,
         p.created_at,
         u.name as created_by_name,
         COALESCE(v.votes, '{}'::jsonb) as votes
       FROM family_polls p
       JOIN family_users u ON u.id = p.created_by
       LEFT JOIN LATERAL (
         SELECT jsonb_object_agg(option_index, count) as votes
         FROM (
           SELECT option_index, COUNT(*) as count
           FROM family_poll_votes
           WHERE poll_id = p.id
           GROUP BY option_index
         ) x
       ) v ON TRUE
       ORDER BY p.created_at DESC
       LIMIT 20`
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Erro GET /api/family-polls:', error);
    return NextResponse.json({ message: 'Erro ao carregar enquetes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'create') {
      const { question, options, user_id } = body;
      const q = String(question || '').trim();
      const opts: string[] = Array.isArray(options)
        ? options.map((o: any) => String(o || '').trim()).filter(o => o.length > 0)
        : [];

      if (!q || !user_id || opts.length < 2) {
        return NextResponse.json({ message: 'Preencha pergunta e pelo menos 2 opções' }, { status: 400 });
      }

      await query(
        'INSERT INTO family_polls (question, options, created_by) VALUES ($1, $2, $3)',
        [q, opts, Number(user_id)]
      );

      return NextResponse.json({ success: true });
    }

    if (action === 'vote') {
      const { poll_id, option_index, user_id } = body;

      if (!poll_id || user_id == null || option_index == null) {
        return NextResponse.json({ message: 'Dados de voto inválidos' }, { status: 400 });
      }

      const pollId = Number(poll_id);
      const userId = Number(user_id);
      const optionIdx = Number(option_index);

      await query(
        'DELETE FROM family_poll_votes WHERE poll_id = $1 AND user_id = $2',
        [pollId, userId]
      );

      await query(
        'INSERT INTO family_poll_votes (poll_id, user_id, option_index) VALUES ($1, $2, $3)',
        [pollId, userId, optionIdx]
      );

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ message: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    console.error('Erro POST /api/family-polls:', error);
    return NextResponse.json({ message: 'Erro ao processar enquete' }, { status: 500 });
  }
}
