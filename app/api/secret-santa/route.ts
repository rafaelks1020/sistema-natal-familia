import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import { drawSecretSanta, validateRules, DrawRule } from '@/app/lib/secretSanta';

// Gerar token único de 8 caracteres
function generateToken(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

// GET - Buscar configuração ativa e sorteios
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    // Buscar configuração ativa
    if (action === 'config') {
      const { rows } = await query(`
        SELECT * FROM secret_santa_config 
        WHERE is_active = true 
        ORDER BY created_at DESC 
        LIMIT 1
      `);
      return NextResponse.json(rows[0] || null);
    }
    
    // Revelar por token
    if (action === 'reveal-by-token') {
      const token = searchParams.get('token');
      if (!token) {
        return NextResponse.json({ error: 'Token é obrigatório' }, { status: 400 });
      }
      
      const { rows } = await query(
        `SELECT 
          d.id,
          d.revealed,
          d.revealed_at,
          d.token,
          giver.name as giver_name,
          receiver.id as receiver_id,
          receiver.name as receiver_name
        FROM secret_santa_draws d
        JOIN participants giver ON d.giver_id = giver.id
        JOIN participants receiver ON d.receiver_id = receiver.id
        WHERE d.token = $1`,
        [token.toUpperCase()]
      );
      
      if (rows.length === 0) {
        return NextResponse.json({ error: 'Token inválido' }, { status: 404 });
      }
      
      return NextResponse.json(rows[0]);
    }
    
    // Buscar todos os tokens (admin) - NÃO mostra quem tirou quem
    if (action === 'all-draws') {
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
      
      const { rows } = await query(
        `SELECT 
          d.id,
          d.token,
          d.revealed,
          d.revealed_at,
          g.name as giver_name
        FROM secret_santa_draws d
        JOIN participants g ON d.giver_id = g.id
        WHERE d.config_id = $1
        ORDER BY g.name`,
        [configId]
      );
      
      return NextResponse.json(rows);
    }
    
    return NextResponse.json({ error: 'Ação não encontrada' }, { status: 404 });
    
  } catch (error) {
    console.error('Erro GET secret-santa:', error);
    return NextResponse.json({ error: 'Erro no servidor' }, { status: 500 });
  }
}

// POST - Criar sorteio
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { action } = data;
    
    // Criar nova configuração e fazer sorteio
    if (action === 'draw') {
      const { rules = [], min_gift_value, max_gift_value, reveal_date } = data;
      
      // Buscar todos os participantes pagos
      const { rows: participants } = await query(`
        SELECT id, name FROM participants 
        WHERE paid = true
        ORDER BY name
      `);
      
      if (participants.length < 3) {
        return NextResponse.json(
          { error: 'É necessário pelo menos 3 participantes que pagaram para fazer o sorteio' },
          { status: 400 }
        );
      }
      
      // Validar regras
      const validation = validateRules(participants, rules);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400 }
        );
      }
      
      // Fazer o sorteio
      let drawResults;
      try {
        drawResults = drawSecretSanta(participants, rules);
      } catch (error: any) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      
      if (!drawResults) {
        return NextResponse.json(
          { error: 'Não foi possível realizar o sorteio' },
          { status: 500 }
        );
      }
      
      // Desativar configurações anteriores
      await query('UPDATE secret_santa_config SET is_active = false');
      
      // Criar nova configuração
      const { rows: configs } = await query(
        `INSERT INTO secret_santa_config (
          is_active, 
          min_gift_value, 
          max_gift_value, 
          reveal_date,
          rules
        ) VALUES (
          true,
          $1,
          $2,
          $3,
          $4
        ) RETURNING id`,
        [
          min_gift_value || null,
          max_gift_value || null,
          reveal_date || null,
          JSON.stringify(rules),
        ]
      );
      
      const configId = configs[0].id;
      
      // Salvar sorteios com tokens únicos
      for (const draw of drawResults) {
        const token = generateToken();
        await query(
          `INSERT INTO secret_santa_draws (
            config_id, 
            giver_id, 
            receiver_id,
            token
          ) VALUES (
            $1,
            $2,
            $3,
            $4
          )`,
          [configId, draw.giver_id, draw.receiver_id, token]
        );
      }
      
      return NextResponse.json({
        success: true,
        config_id: configId,
        total_participants: participants.length
      });
    }
    
    // Revelar usando token
    if (action === 'reveal') {
      const { token } = data;
      
      if (!token) {
        return NextResponse.json({ error: 'Token é obrigatório' }, { status: 400 });
      }
      
      const { rows } = await query(
        `UPDATE secret_santa_draws 
         SET revealed = true, revealed_at = NOW()
         WHERE token = $1
         RETURNING id`,
        [token.toUpperCase()]
      );
      
      if (rows.length === 0) {
        return NextResponse.json({ error: 'Token inválido' }, { status: 404 });
      }
      
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: 'Ação não encontrada' }, { status: 404 });
    
  } catch (error) {
    console.error('Erro POST secret-santa:', error);
    return NextResponse.json({ error: 'Erro no servidor' }, { status: 500 });
  }
}

// DELETE - Cancelar sorteio
export async function DELETE(request: NextRequest) {
  try {
    // Desativar configuração ativa
    await query('UPDATE secret_santa_config SET is_active = false');
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Erro DELETE secret-santa:', error);
    return NextResponse.json({ error: 'Erro no servidor' }, { status: 500 });
  }
}
