import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

// GET: lista todos os participantes com status de presença
export async function GET() {
  try {
    const { rows } = await query(
      `SELECT p.id as participant_id, p.name, a.status
       FROM participants p
       LEFT JOIN family_attendance a ON a.participant_id = p.id`
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Erro GET /api/family-attendance:', error);
    return NextResponse.json({ message: 'Erro ao carregar presença' }, { status: 500 });
  }
}

// POST: atualiza presença do usuário logado no mural
export async function POST(request: NextRequest) {
  try {
    const { status, user_id } = await request.json();

    const validStatuses = ['yes', 'maybe', 'no'];
    if (!user_id || !status || !validStatuses.includes(String(status))) {
      return NextResponse.json({ message: 'Dados inválidos' }, { status: 400 });
    }

    const userId = Number(user_id);
    const statusValue = String(status);

    // Buscar o usuário da família para descobrir o nome
    const userResult = await query(
      'SELECT name FROM family_users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ message: 'Usuário do mural não encontrado' }, { status: 404 });
    }

    const name = userResult.rows[0].name as string;

    // Encontrar participante com o mesmo nome
    const participantResult = await query(
      'SELECT id FROM participants WHERE name = $1 LIMIT 1',
      [name]
    );

    if (participantResult.rows.length === 0) {
      return NextResponse.json({ message: 'Nenhum participante encontrado para este usuário' }, { status: 400 });
    }

    const participantId = participantResult.rows[0].id as number;

    // Verificar se já existe registro de presença
    const existing = await query(
      'SELECT id FROM family_attendance WHERE participant_id = $1 LIMIT 1',
      [participantId]
    );

    if (existing.rows.length > 0) {
      await query(
        'UPDATE family_attendance SET status = $1, user_id = $2, updated_at = NOW() WHERE id = $3',
        [statusValue, userId, existing.rows[0].id]
      );
    } else {
      await query(
        'INSERT INTO family_attendance (participant_id, user_id, status) VALUES ($1, $2, $3)',
        [participantId, userId, statusValue]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro POST /api/family-attendance:', error);
    return NextResponse.json({ message: 'Erro ao atualizar presença' }, { status: 500 });
  }
}
