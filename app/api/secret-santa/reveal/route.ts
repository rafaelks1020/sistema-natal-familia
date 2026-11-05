import { HttpError, ok, requireUser, route } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { Receiver } from '../shared';

// POST /api/secret-santa/reveal
// Marca o sorteio de quem está logado (revealed_at na primeira vez) e devolve o receiver.
// Não aceita token nem id de outra pessoa: a sessão é a identidade.

export const dynamic = 'force-dynamic';

interface RevealRow {
  participant_id: number;
  name: string;
  avatar_url: string | null;
}

export const POST = route(async () => {
  const me = await requireUser();
  if (!me.participant_id) {
    throw new HttpError(400, 'Sua conta ainda não está na lista da família.');
  }

  const { rows } = await query<RevealRow>(
    `WITH active AS (
       SELECT id FROM secret_santa_config
        WHERE is_active IS TRUE
        ORDER BY created_at DESC, id DESC
        LIMIT 1
     ),
     upd AS (
       UPDATE secret_santa_draws d
          SET revealed = true,
              revealed_at = COALESCE(d.revealed_at, NOW())
        WHERE d.config_id = (SELECT id FROM active)
          AND d.giver_id = $1
        RETURNING d.receiver_id
     )
     SELECT r.id AS participant_id, r.name, u.avatar_url
       FROM upd
       JOIN participants r ON r.id = upd.receiver_id
       LEFT JOIN family_users u ON u.id = r.user_id`,
    [me.participant_id],
  );

  const row = rows[0];
  if (!row) {
    const active = await query('SELECT 1 FROM secret_santa_config WHERE is_active IS TRUE LIMIT 1');
    if (!active.rows.length) throw new HttpError(404, 'Não há sorteio ativo.');
    throw new HttpError(404, 'Você não está neste sorteio.');
  }

  const receiver: Receiver = {
    participant_id: row.participant_id,
    name: row.name,
    avatar_url: row.avatar_url,
  };
  return ok({ receiver });
});
