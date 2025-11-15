import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

// GET - Buscar lista de desejos
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const participantId = searchParams.get('participant_id');
    
    // Buscar configuração ativa
    const { rows: configs } = await query(`
      SELECT id FROM secret_santa_config 
      WHERE is_active = true 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (configs.length === 0) {
      return NextResponse.json([]);
    }
    
    const configId = configs[0].id;
    
    if (participantId) {
      // Buscar lista de desejos de um participante específico
      const { rows } = await query(
        `SELECT * FROM wish_list
         WHERE participant_id = $1
           AND config_id = $2
         ORDER BY priority DESC, created_at ASC`,
        [parseInt(participantId), configId]
      );
      return NextResponse.json(rows);
    } else {
      // Buscar todas as listas (admin)
      const { rows } = await query(`
        SELECT 
          w.*,
          p.name as participant_name
        FROM wish_list w
        JOIN participants p ON w.participant_id = p.id
        WHERE w.config_id = $1
        ORDER BY p.name, w.priority DESC`,
        [configId]
      );
      return NextResponse.json(rows);
    }
    
  } catch (error) {
    console.error('Erro GET wishlist:', error);
    return NextResponse.json({ error: 'Erro no servidor' }, { status: 500 });
  }
}

// POST - Adicionar item à lista de desejos
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { participant_id, item_name, item_description, item_url, priority } = data;
    
    if (!participant_id || !item_name) {
      return NextResponse.json(
        { error: 'participant_id e item_name são obrigatórios' },
        { status: 400 }
      );
    }
    
    // Buscar configuração ativa
    const { rows: configs } = await query(`
      SELECT id FROM secret_santa_config 
      WHERE is_active = true 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (configs.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum sorteio ativo. Peça ao admin para criar um sorteio primeiro.' },
        { status: 404 }
      );
    }
    
    const configId = configs[0].id;
    
    const { rows } = await query(
      `INSERT INTO wish_list (
        participant_id,
        config_id,
        item_name,
        item_description,
        item_url,
        priority
      ) VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6
      ) RETURNING *`,
      [
        parseInt(participant_id),
        configId,
        item_name,
        item_description || null,
        item_url || null,
        priority || 1,
      ]
    );
    
    return NextResponse.json(rows[0], { status: 201 });
    
  } catch (error) {
    console.error('Erro POST wishlist:', error);
    return NextResponse.json({ error: 'Erro no servidor' }, { status: 500 });
  }
}

// PUT - Atualizar item da lista
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    const { id, item_name, item_description, item_url, priority, purchased } = data;
    
    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }
    
    const { rows } = await query(
      `UPDATE wish_list
       SET 
         item_name = COALESCE($1, item_name),
         item_description = COALESCE($2, item_description),
         item_url = COALESCE($3, item_url),
         priority = COALESCE($4, priority),
         purchased = COALESCE($5, purchased)
       WHERE id = $6
       RETURNING *`,
      [
        item_name ?? null,
        item_description ?? null,
        item_url ?? null,
        priority ?? null,
        purchased ?? null,
        parseInt(id),
      ]
    );
    
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });
    }
    
    return NextResponse.json(rows[0]);
    
  } catch (error) {
    console.error('Erro PUT wishlist:', error);
    return NextResponse.json({ error: 'Erro no servidor' }, { status: 500 });
  }
}

// DELETE - Remover item da lista
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }
    
    await query('DELETE FROM wish_list WHERE id = $1', [parseInt(id)]);
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Erro DELETE wishlist:', error);
    return NextResponse.json({ error: 'Erro no servidor' }, { status: 500 });
  }
}
