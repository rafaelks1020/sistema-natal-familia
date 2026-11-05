import { cleanText, HttpError, ok, readJson, requireUser, route, toInt } from '@/app/lib/api';
import { transaction } from '@/app/lib/db';
import { edicaoAtual, hojeSP } from '@/app/lib/edicao';
import { enviarPush } from '@/app/lib/push';
import { loadHints, requireEdition } from '../features';
export const dynamic = 'force-dynamic';
export const GET = route(async () => ok(await loadHints(await requireUser())));
export const POST = route(async req => {
  const me = await requireUser();
  if (!me.participant_id) throw new HttpError(403, 'Sua conta precisa estar na lista da família.');
  const body = await readJson<Record<string, unknown>>(req);
  const texto = cleanText(body.texto, 'a dica', 280);
  const userIds = await transaction(async q => {
    await q('SELECT pg_advisory_xact_lock(714203)');
    const configId = await requireEdition(q);
    const draw = await q<{ receiver_id: number; user_id: number | null }>(
      `SELECT d.receiver_id, p.user_id FROM secret_santa_draws d JOIN participants p ON p.id = d.receiver_id
       WHERE d.config_id = $1 AND d.giver_id = $2 AND d.revealed IS TRUE`, [configId, me.participant_id]);
    const target = draw.rows[0];
    if (!target) throw new HttpError(403, 'Abra seu bilhete antes de enviar uma dica.');
    const live = await q('SELECT 1 FROM secret_santa_live WHERE ano = $1', [edicaoAtual()]);
    if (live.rows.length) throw new HttpError(409, 'As dicas encerraram com o início da revelação.');
    const count = await q<{ n: number }>(
      `SELECT count(*)::int AS n FROM secret_santa_hints WHERE ano = $1 AND user_id = $2
       AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = $3::date`, [edicaoAtual(), me.id, hojeSP()]);
    if (count.rows[0].n >= 3) throw new HttpError(429, 'Você já enviou 3 dicas hoje. Amanhã tem mais.');
    const muted = await q('SELECT 1 FROM secret_santa_hint_mutes WHERE ano = $1 AND receiver_participant_id = $2', [edicaoAtual(), target.receiver_id]);
    if (muted.rows.length) throw new HttpError(403, 'Seu amigo oculto preferiu não receber mais dicas.');
    if (target.user_id) {
      const blocked = await q('SELECT 1 FROM user_blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)', [target.user_id, me.id]);
      if (blocked.rows.length) throw new HttpError(403, 'Não foi possível enviar a dica.');
    }
    const quota = await q(
      `INSERT INTO secret_santa_hint_days(ano, user_id, dia, total) VALUES($1,$2,$3::date,1)
       ON CONFLICT(ano,user_id,dia) DO UPDATE SET total = secret_santa_hint_days.total + 1
       WHERE secret_santa_hint_days.total < 3 RETURNING total`, [edicaoAtual(), me.id, hojeSP()]);
    if (!quota.rows.length) throw new HttpError(429, 'Você já enviou 3 dicas hoje. Amanhã tem mais.');
    await q('INSERT INTO secret_santa_hints(ano, config_id, user_id, receiver_participant_id, texto) VALUES($1,$2,$3,$4,$5)', [edicaoAtual(), configId, me.id, target.receiver_id, texto]);
    return target.user_id ? [target.user_id] : [];
  });
  void enviarPush(userIds, { titulo: 'Dica do seu amigo oculto', corpo: 'Chegou uma dica anônima para você.', rota: '/amigo-oculto' });
  return ok({ ok: true }, 201);
});
export const DELETE = route(async req => {
  const me = await requireUser();
  const body = await readJson<Record<string, unknown>>(req);
  const id = toInt(body.id);
  await transaction(async q => {
    const found = await q<{ user_id: number; receiver_participant_id: number }>('SELECT user_id, receiver_participant_id FROM secret_santa_hints WHERE id = $1 AND ano = $2 FOR UPDATE', [id, edicaoAtual()]);
    const hint = found.rows[0];
    if (!hint || (!me.is_admin && hint.receiver_participant_id !== me.participant_id)) throw new HttpError(404, 'Dica não encontrada.');
    if (body.action === 'silenciar' || body.action === 'block') {
      // Nunca grava em user_blocks: a lista de bloqueados mostraria o nome do amigo oculto.
      if (hint.receiver_participant_id !== me.participant_id) throw new HttpError(403, 'Só quem recebe pode silenciar as dicas.');
      await q(`INSERT INTO secret_santa_hint_mutes(ano, receiver_participant_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,
        [edicaoAtual(), hint.receiver_participant_id]);
    } else {
      if (!me.is_admin) throw new HttpError(403, 'Só quem organiza pode apagar dicas.');
      await q('DELETE FROM secret_santa_hints WHERE id = $1', [id]);
    }
  });
  return ok({ ok: true });
});
