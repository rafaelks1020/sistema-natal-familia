import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

const CONTRIBUTION = 50;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const [resource] = slug;

  try {
    if (resource === 'participants') {
      const { rows } = await query('SELECT * FROM participants ORDER BY name');
      return NextResponse.json(rows);
    }

    if (resource === 'purchases') {
      const { rows } = await query('SELECT * FROM purchases ORDER BY created_at DESC');
      return NextResponse.json(rows);
    }

    if (resource === 'timeline') {
      const { rows: payments } = await query(`
        SELECT 
          id, 'payment' as type, 'Contribuição recebida' as description,
          $1 as value, paid_date as date, name
        FROM participants WHERE paid = true
      `, [CONTRIBUTION]);
      const { rows: purchases } = await query(`
        SELECT 
          id, 'purchase' as type, description,
          value, created_at as date, category, brand, color, size, quantity, notes, image_url, image_urls
        FROM purchases
      `);
      const timeline = [...payments, ...purchases]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return NextResponse.json(timeline);
    }

    return NextResponse.json({ error: 'Rota não encontrada' }, { status: 404 });
  } catch (error) {
    console.error('Erro GET:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: 'Erro no servidor', details: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const [resource] = slug;

  try {
    const data = await request.json();

    if (resource === 'participants') {
      const { rows } = await query(
        'INSERT INTO participants (name) VALUES ($1) RETURNING *',
        [data.name]
      );
      return NextResponse.json(rows[0], { status: 201 });
    }

    if (resource === 'purchases') {
      const { rows } = await query(
        `INSERT INTO purchases (
          description, value, category, brand, color, size, quantity, notes, image_url, image_urls
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        ) RETURNING *`,
        [
          data.description,
          parseFloat(data.value),
          data.category,
          data.brand || null,
          data.color || null,
          data.size || null,
          data.quantity || 1,
          data.notes || null,
          data.image_url || null,
          data.image_urls || null,
        ]
      );
      return NextResponse.json(rows[0], { status: 201 });
    }

    return NextResponse.json({ error: 'Rota não encontrada' }, { status: 404 });
  } catch (error) {
    console.error('Erro POST:', error);
    return NextResponse.json({ error: 'Erro no servidor' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const [resource, id] = slug;

  try {
    const data = await request.json();

    if (resource === 'participants') {
      const { rows } = await query(
        'UPDATE participants SET paid = $1, paid_date = $2 WHERE id = $3 RETURNING *',
        [
          data.paid,
          data.paid ? new Date().toISOString() : null,
          parseInt(id),
        ]
      );
      return NextResponse.json(rows[0]);
    }

    return NextResponse.json({ error: 'Rota não encontrada' }, { status: 404 });
  } catch (error) {
    console.error('Erro PUT:', error);
    return NextResponse.json({ error: 'Erro no servidor' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const [resource, id] = slug;

  try {
    if (resource === 'participants') {
      await query('DELETE FROM participants WHERE id = $1', [parseInt(id)]);
      return NextResponse.json({ success: true });
    }

    if (resource === 'purchases') {
      await query('DELETE FROM purchases WHERE id = $1', [parseInt(id)]);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Rota não encontrada' }, { status: 404 });
  } catch (error) {
    console.error('Erro DELETE:', error);
    return NextResponse.json({ error: 'Erro no servidor' }, { status: 500 });
  }
}
