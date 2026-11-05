import { HttpError, ok, readJson, requireAdmin, requireUser, route, toInt } from '@/app/lib/api';
import { transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { enviarPush } from '@/app/lib/push';
import type { DrawResult } from '@/app/lib/secretSanta';
import { loadLive, requireEdition } from '../features';
export const dynamic = 'force-dynamic';
export const GET = route(async () => { await requireUser(); return ok(await loadLive()); });
export const POST = route(async req => {
  await requireAdmin();
  const body = await readJson<Record<string, unknown>>(req);
  if (body.action !== 'start' && body.action !== 'next') throw new HttpError(400, 'Ação inválida.');
  const users = await transaction(async q => {
    await q('SELECT pg_advisory_xact_lock(714203)');
    const configId = await requireEdition(q);
    const found = await q<{ atual: number; ordem: DrawResult[]; encerrado_em: string | null }>('SELECT atual, ordem, encerrado_em FROM secret_santa_live WHERE ano = $1 FOR UPDATE', [edicaoAtual()]);
    const live = found.rows[0];
    if (body.action === 'start') {
      if (live) throw new HttpError(409, 'A revelação desta edição já começou.');
      const pairs = await q<DrawResult>('SELECT giver_id, receiver_id FROM secret_santa_draws WHERE config_id = $1 ORDER BY random()', [configId]);
      if (!pairs.rows.length) throw new HttpError(409, 'O sorteio ainda não tem pares.');
      await q('INSERT INTO secret_santa_live(ano,config_id,ordem) VALUES($1,$2,$3::jsonb)', [edicaoAtual(), configId, JSON.stringify(pairs.rows)]);
      const all = await q<{ id: number }>('SELECT id FROM family_users');
      return all.rows.map(u => u.id);
    }
    if (!live) throw new HttpError(409, 'Inicie a revelação primeiro.');
    // O cliente informa a posição observada para um toque duplicado não pular um par.
    const expected = body.atual === -1 ? -1 : toInt(Number(body.atual) + 1, 'posição') - 1;
    if (expected !== live.atual || live.encerrado_em) throw new HttpError(409, 'A revelação avançou. Atualize a tela.');
    const next = live.atual + 1;
    const last = next === live.ordem.length - 1;
    await q('UPDATE secret_santa_live SET atual = $2, encerrado_em = CASE WHEN $3 THEN NOW() ELSE NULL END WHERE ano = $1', [edicaoAtual(), next, last]);
    if (last) {
      await q(`INSERT INTO secret_santa_history(ano,giver_participant_id,receiver_participant_id,revelado)
        SELECT $1,giver_id,receiver_id,true FROM secret_santa_draws WHERE config_id = $2
        ON CONFLICT(ano,giver_participant_id) DO UPDATE SET receiver_participant_id = EXCLUDED.receiver_participant_id, revelado = true`, [edicaoAtual(), configId]);
    }
    return [];
  });
  if (body.action === 'start') void enviarPush(users, { titulo: 'A revelação começou!', corpo: 'Acompanhe o amigo oculto ao vivo com a família.', rota: '/amigo-oculto-ao-vivo' });
  return ok(await loadLive());
});
