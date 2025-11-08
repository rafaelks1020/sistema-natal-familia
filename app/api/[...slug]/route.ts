import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

const CONTRIBUTION = 50;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const [resource] = slug;

  try {
    if (resource === 'participants') {
      const { rows } = await sql`SELECT * FROM participants ORDER BY name`;
      return NextResponse.json(rows);
    }

    if (resource === 'purchases') {
      const { rows } = await sql`SELECT * FROM purchases ORDER BY created_at DESC`;
      return NextResponse.json(rows);
    }

    if (resource === 'timeline') {
      const { rows: payments } = await sql`
        SELECT 
          id, 'payment' as type, 'Contribuição recebida' as description,
          ${CONTRIBUTION} as value, paid_date as date, name
        FROM participants WHERE paid = true
      `;
      const { rows: purchases } = await sql`
        SELECT 
          id, 'purchase' as type, description,
          value, created_at as date, category, brand, color, size, quantity, notes, image_url, image_urls
        FROM purchases
      `;
      const timeline = [...payments, ...purchases]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return NextResponse.json(timeline);
    }

    return NextResponse.json({ error: 'Rota não encontrada' }, { status: 404 });
  } catch (error) {
    console.error('Erro GET:', error);
    return NextResponse.json({ error: 'Erro no servidor' }, { status: 500 });
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
      const { rows } = await sql`
        INSERT INTO participants (name) VALUES (${data.name}) RETURNING *
      `;
      return NextResponse.json(rows[0], { status: 201 });
    }

    if (resource === 'purchases') {
      const { rows } = await sql`
        INSERT INTO purchases (
          description, value, category, brand, color, size, quantity, notes, image_url, image_urls
        ) VALUES (
          ${data.description}, ${parseFloat(data.value)}, ${data.category},
          ${data.brand || null}, ${data.color || null}, ${data.size || null},
          ${data.quantity || 1}, ${data.notes || null}, ${data.image_url || null}, ${data.image_urls || null}
        ) RETURNING *
      `;
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
      const { rows } = await sql`
        UPDATE participants 
        SET paid = ${data.paid}, paid_date = ${data.paid ? new Date().toISOString() : null}
        WHERE id = ${parseInt(id)}
        RETURNING *
      `;
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
      await sql`DELETE FROM participants WHERE id = ${parseInt(id)}`;
      return NextResponse.json({ success: true });
    }

    if (resource === 'purchases') {
      await sql`DELETE FROM purchases WHERE id = ${parseInt(id)}`;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Rota não encontrada' }, { status: 404 });
  } catch (error) {
    console.error('Erro DELETE:', error);
    return NextResponse.json({ error: 'Erro no servidor' }, { status: 500 });
  }
}
