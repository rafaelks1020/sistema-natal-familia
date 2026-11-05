import { HttpError, ok, readJson, requireAdmin, requireUser, route, toInt } from '@/app/lib/api';
import { transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { loadHistory } from '../features';
export const dynamic = 'force-dynamic';
export const GET = route(async () => { await requireUser(); return ok(await loadHistory()); });
export const POST = route(async req => {
  await requireAdmin();
  const body = await readJson<Record<string, unknown>>(req);
  const ano = toInt(body.ano, 'ano');
  if (ano < 1900 || ano >= edicaoAtual()) throw new HttpError(400, 'Cadastre somente edições anteriores.');
  if (body.confirm_revealed !== true) throw new HttpError(400, 'Confirme que esse ano já foi revelado.');
  if (!Array.isArray(body.pairs) || body.pairs.length < 2 || body.pairs.length > 200) throw new HttpError(400, 'Informe todos os pares daquele ano.');
  const pairs = body.pairs.map((p: Record<string, unknown>) => ({ giver: toInt(p?.giver_participant_id), receiver: toInt(p?.receiver_participant_id) }));
  const givers = new Set(pairs.map(p => p.giver)), receivers = new Set(pairs.map(p => p.receiver));
  if (givers.size !== pairs.length || receivers.size !== pairs.length || pairs.some(p => p.giver === p.receiver) || [...givers].some(id => !receivers.has(id))) throw new HttpError(400, 'Cada pessoa deve dar e receber um presente, sem tirar a si mesma.');
  await transaction(async q => {
    await q('SELECT pg_advisory_xact_lock(714203)');
    const people = await q('SELECT id FROM participants WHERE id = ANY($1::int[])', [[...givers]]);
    if (people.rows.length !== givers.size) throw new HttpError(400, 'Alguma pessoa não está na família.');
    const existing = await q('SELECT 1 FROM secret_santa_history WHERE ano = $1 LIMIT 1', [ano]);
    if (existing.rows.length && body.replace !== true) throw new HttpError(409, 'Esse ano já tem histórico. Confirme para substituir.');
    await q('DELETE FROM secret_santa_history WHERE ano = $1', [ano]);
    for (const pair of pairs) await q('INSERT INTO secret_santa_history(ano,giver_participant_id,receiver_participant_id,revelado) VALUES($1,$2,$3,true)', [ano, pair.giver, pair.receiver]);
  });
  return ok({ ok: true });
});
