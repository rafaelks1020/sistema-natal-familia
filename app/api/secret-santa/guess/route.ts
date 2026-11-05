import { HttpError, ok, readJson, requireUser, route, toInt } from '@/app/lib/api';
import { transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { requireEdition } from '../features';
export const POST = route(async req => {
  const me = await requireUser();
  if (!me.participant_id) throw new HttpError(403, 'Você precisa participar do sorteio.');
  const body = await readJson<Record<string, unknown>>(req);
  const guessed = toInt(body.participant_id, 'palpite');
  await transaction(async q => {
    await q('SELECT pg_advisory_xact_lock(714203)');
    const configId = await requireEdition(q);
    const live = await q('SELECT 1 FROM secret_santa_live WHERE ano = $1', [edicaoAtual()]);
    if (live.rows.length) throw new HttpError(409, 'Os palpites encerraram com o início da revelação.');
    const people = await q('SELECT giver_id FROM secret_santa_draws WHERE config_id = $1 AND giver_id = ANY($2::int[])', [configId, [me.participant_id, guessed]]);
    if (guessed === me.participant_id || people.rows.length !== 2) throw new HttpError(400, 'Escolha outra pessoa deste sorteio.');
    await q(`INSERT INTO secret_santa_guesses(ano, config_id, user_id, participant_id, guessed_participant_id)
      VALUES($1,$2,$3,$4,$5) ON CONFLICT(config_id, participant_id)
      DO UPDATE SET guessed_participant_id = EXCLUDED.guessed_participant_id, created_at = NOW()`, [edicaoAtual(), configId, me.id, me.participant_id, guessed]);
  });
  return ok({ ok: true });
});
