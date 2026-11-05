import { route, requireUser, requireAdmin, HttpError, readJson, toInt, cleanText, isBlobUrl, ok } from '@/app/lib/api';
import { query, transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { enviarPush } from '@/app/lib/push';
import { getChallenges, type Challenge } from './data';

export const GET = route(async () => ok(await getChallenges(await requireUser())));

export const POST = route(async (req) => {
  await requireAdmin();
  const body = await readJson(req);
  const titulo = cleanText(body?.titulo, 'o nome do desafio', 120);
  const ano = edicaoAtual();
  const challenge = await transaction(async (q) => {
    // Serializa aberturas da mesma edição, inclusive quando ainda não existe desafio.
    await q('SELECT pg_advisory_xact_lock($1, $2)', [2201, ano]);
    const opened = await q('SELECT id FROM party_challenges WHERE ano = $1 AND aberto', [ano]);
    if (opened.rows.length) throw new HttpError(409, 'Encerre o desafio aberto antes de começar outro.');
    return (await q<Challenge>('INSERT INTO party_challenges (ano, titulo) VALUES ($1, $2) RETURNING *', [ano, titulo])).rows[0];
  });
  const { rows } = await query<{ id: number }>('SELECT id FROM family_users');
  void enviarPush(rows.map((u) => u.id), { titulo: 'Desafio de foto aberto!', corpo: titulo, rota: '/festa-desafio' });
  return ok(challenge, 201);
});

export const PATCH = route(async (req) => {
  await requireAdmin();
  const body = await readJson(req);
  const id = toInt(body?.desafio_id);
  const { rows } = await query('UPDATE party_challenges SET aberto = false, encerrado_em = NOW() WHERE id = $1 AND ano = $2 AND aberto RETURNING id', [id, edicaoAtual()]);
  if (!rows.length) throw new HttpError(409, 'Este desafio já foi encerrado ou não está nesta edição.');
  return ok({ ok: true });
});

export const PUT = route(async (req) => {
  const me = await requireUser();
  const body = await readJson(req);
  const desafio = toInt(body?.desafio_id);
  const ano = edicaoAtual();
  const result = await transaction(async (q) => {
    const { rows } = await q<Challenge>('SELECT * FROM party_challenges WHERE id = $1 AND ano = $2 FOR UPDATE', [desafio, ano]);
    if (!rows[0]?.aberto) throw new HttpError(409, 'Este desafio não está aberto.');
    if (body?.acao === 'votar') {
      const entry = toInt(body.entry_id, 'foto');
      const candidate = await q<{ user_id: number }>(`SELECT e.user_id FROM party_photo_entries e WHERE e.id = $1 AND e.desafio_id = $2 AND e.ano = $3
        AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $4 AND b.blocked_id = e.user_id)`, [entry, desafio, ano, me.id]);
      if (!candidate.rows.length) throw new HttpError(404, 'Foto não encontrada.');
      if (candidate.rows[0].user_id === me.id) throw new HttpError(400, 'Escolha a foto de outra pessoa para votar.');
      await q(`INSERT INTO party_photo_votes (ano, desafio_id, entry_id, user_id) VALUES ($1, $2, $3, $4)
        ON CONFLICT (desafio_id, user_id) DO UPDATE SET entry_id = EXCLUDED.entry_id, created_at = NOW()`, [ano, desafio, entry, me.id]);
    } else if (body?.acao === 'foto') {
      if (!isBlobUrl(body.image_url)) throw new HttpError(400, 'Envie a foto pelo aplicativo ou pelo site.');
      const legenda = cleanText(body.legenda, 'a legenda', 500, false);
      // Trocar a foto reinicia os votos recebidos para não transferir votos para outra imagem.
      await q(`DELETE FROM party_photo_votes WHERE entry_id IN (SELECT id FROM party_photo_entries WHERE desafio_id = $1 AND user_id = $2)`, [desafio, me.id]);
      await q(`INSERT INTO party_photo_entries (ano, desafio_id, user_id, image_url, legenda) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (desafio_id, user_id) DO UPDATE SET image_url = EXCLUDED.image_url, legenda = EXCLUDED.legenda, created_at = NOW()`, [ano, desafio, me.id, body.image_url, legenda]);
    } else throw new HttpError(400, 'Ação inválida.');
    return { ok: true };
  });
  return ok(result);
});

export const DELETE = route(async (req) => {
  const me = await requireUser();
  const body = await readJson(req);
  const id = toInt(body?.entry_id);
  await transaction(async (q) => {
    const challenge = await q<Challenge>(`SELECT c.* FROM party_challenges c JOIN party_photo_entries e ON e.desafio_id = c.id
      WHERE e.id = $1 AND c.ano = $2 FOR UPDATE OF c`, [id, edicaoAtual()]);
    if (!challenge.rows.length) throw new HttpError(404, 'Foto não encontrada.');
    if (!me.is_admin && !challenge.rows[0].aberto) throw new HttpError(409, 'O desafio já foi encerrado.');
    const removed = await q('DELETE FROM party_photo_entries WHERE id = $1 AND (user_id = $2 OR $3::boolean) RETURNING id', [id, me.id, me.is_admin]);
    if (!removed.rows.length) throw new HttpError(403, 'Você só pode apagar sua própria foto.');
  });
  return ok({ ok: true });
});
