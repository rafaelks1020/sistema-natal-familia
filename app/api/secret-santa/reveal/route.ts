import { edicaoAtual } from '@/app/lib/edicao';
import { HttpError, ok, requireUser, route } from '@/app/lib/api';
import { transaction } from '@/app/lib/db';
import { canReveal, mapConfig, Receiver } from '../shared';

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

  const row = await transaction(async (q) => {
    await q('SELECT pg_advisory_xact_lock(714203)');
    const active = await q<{
      id: number; min_gift_value: unknown; max_gift_value: unknown; reveal_date: string | null;
    }>(
      `SELECT id, min_gift_value, max_gift_value,
              to_char(reveal_date, 'YYYY-MM-DD') AS reveal_date
         FROM secret_santa_config WHERE is_active IS TRUE AND ano = $1
        ORDER BY created_at DESC, id DESC LIMIT 1`,
      [edicaoAtual()],
    );
    if (!active.rows[0]) throw new HttpError(404, 'Não há sorteio ativo.');
    const config = mapConfig(active.rows[0]);
    if (!canReveal(config)) {
      const [, month, day] = config.reveal_date!.split('-');
      throw new HttpError(403, `A revelação abre em ${day}/${month}.`);
    }
    const { rows } = await q<RevealRow>(
      `WITH upd AS (
         UPDATE secret_santa_draws
            SET revealed = true, revealed_at = COALESCE(revealed_at, NOW())
          WHERE config_id = $1 AND giver_id = $2
          RETURNING receiver_id
       )
       SELECT r.id AS participant_id, r.name, u.avatar_url
         FROM upd JOIN participants r ON r.id = upd.receiver_id
         LEFT JOIN family_users u ON u.id = r.user_id`,
      [config.id, me.participant_id],
    );
    if (!rows[0]) throw new HttpError(404, 'Você não está neste sorteio.');
    return rows[0];
  });

  const receiver: Receiver = {
    participant_id: row.participant_id,
    name: row.name,
    avatar_url: row.avatar_url,
  };
  return ok({ receiver });
});
