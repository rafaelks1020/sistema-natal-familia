import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(':');
  const hash = scryptSync(password, salt, 64).toString('hex');
  const keyBuf = Buffer.from(key, 'hex');
  const hashBuf = Buffer.from(hash, 'hex');
  if (keyBuf.length !== hashBuf.length) return false;
  return timingSafeEqual(keyBuf, hashBuf);
}

export async function POST(request: NextRequest) {
  try {
    const { action, username, name, password } = await request.json();

    if (!action || !username || !password || (action === 'register' && !name)) {
      return NextResponse.json({ message: 'Dados inválidos' }, { status: 400 });
    }

    const normalizedUsername = String(username).trim().toLowerCase();

    if (action === 'register') {
      const existing = await query('SELECT id FROM family_users WHERE username = $1', [normalizedUsername]);
      if (existing.rows.length > 0) {
        return NextResponse.json({ message: 'Usuário já existe' }, { status: 400 });
      }

      const trimmedName = String(name).trim();
      const passwordHash = hashPassword(String(password));
      const result = await query(
        'INSERT INTO family_users (name, username, password_hash) VALUES ($1, $2, $3) RETURNING id, name, username',
        [trimmedName, normalizedUsername, passwordHash]
      );

      const user = result.rows[0];

      // Garantir que esse usuário também exista em participants
      try {
        const existingParticipant = await query(
          'SELECT id FROM participants WHERE name = $1 LIMIT 1',
          [trimmedName]
        );

        if (existingParticipant.rows.length === 0) {
          await query('INSERT INTO participants (name) VALUES ($1)', [trimmedName]);
        }
      } catch (err) {
        // Não quebra o cadastro se der erro aqui; apenas loga
        console.error('Erro ao sincronizar family_user com participants:', err);
      }

      return NextResponse.json({ user });
    }

    if (action === 'login') {
      const result = await query(
        'SELECT id, name, username, password_hash FROM family_users WHERE username = $1',
        [normalizedUsername]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ message: 'Usuário ou senha inválidos' }, { status: 401 });
      }

      const user = result.rows[0];
      const ok = verifyPassword(String(password), user.password_hash);
      if (!ok) {
        return NextResponse.json({ message: 'Usuário ou senha inválidos' }, { status: 401 });
      }

      return NextResponse.json({ user: { id: user.id, name: user.name, username: user.username } });
    }

    return NextResponse.json({ message: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    console.error('Erro em /api/family-auth:', error);
    return NextResponse.json({ message: 'Erro no servidor' }, { status: 500 });
  }
}
