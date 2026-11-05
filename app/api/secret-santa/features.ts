import { HttpError } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import type { SessionUser } from '@/app/lib/session';

export async function activeEdition(q = query) {
  const { rows } = await q<{ id: number }>(
    `SELECT id FROM secret_santa_config WHERE is_active IS TRUE AND ano = $1
     ORDER BY created_at DESC, id DESC LIMIT 1`, [edicaoAtual()],
  );
  return rows[0]?.id ?? null;
}
export async function requireEdition(q = query) {
  const id = await activeEdition(q);
  if (!id) throw new HttpError(409, 'Não há sorteio nesta edição.');
  return id;
}
export async function loadTheme() {
  const { rows } = await query<{ key: string; value: string }>(
    "SELECT key, value FROM app_settings WHERE key = ANY($1::text[])",
    [['amigo_tema', 'amigo_valor', 'amigo_evitar_repeticao']],
  );
  const values = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return { tema: values.amigo_tema || 'Livre', valor_centavos: values.amigo_valor ? Number(values.amigo_valor) : null, evitar_repeticao: values.amigo_evitar_repeticao !== 'false' };
}
export async function loadHints(me: SessionUser) {
  const configId = await activeEdition();
  if (!configId || !me.participant_id) return { hints: [], participants: [], guess: null, can_send: false };
  const [hints, participants, guess, mine] = await Promise.all([
    query<{ id: number; texto: string; created_at: string }>(
      `SELECT h.id, h.texto, h.created_at FROM secret_santa_hints h
       WHERE h.ano = $1 AND h.config_id = $2 AND h.receiver_participant_id = $3
         AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $4 AND b.blocked_id = h.user_id)
         AND NOT EXISTS (SELECT 1 FROM secret_santa_hint_mutes m WHERE m.ano = h.ano AND m.receiver_participant_id = h.receiver_participant_id)
       ORDER BY h.created_at DESC, h.id DESC`, [edicaoAtual(), configId, me.participant_id, me.id]),
    query<{ id: number; name: string }>(
      `SELECT p.id, p.name FROM participants p JOIN secret_santa_draws d ON d.giver_id = p.id
       WHERE d.config_id = $1 AND p.id <> $2 ORDER BY lower(p.name), p.id`, [configId, me.participant_id]),
    query<{ guessed_participant_id: number }>(
      'SELECT guessed_participant_id FROM secret_santa_guesses WHERE config_id = $1 AND participant_id = $2', [configId, me.participant_id]),
    query<{ revealed: boolean }>('SELECT revealed FROM secret_santa_draws WHERE config_id = $1 AND giver_id = $2', [configId, me.participant_id]),
  ]);
  return { hints: hints.rows.map(h => ({ id: h.id, texto: h.texto, created_at: h.created_at })), participants: mine.rows.length ? participants.rows : [], guess: guess.rows[0]?.guessed_participant_id ?? null, can_send: mine.rows[0]?.revealed === true };
}
export async function loadHistory() {
  // Só publica a edição inteira depois da revelação coletiva ou de cadastro histórico confirmado.
  const { rows } = await query<{ ano: number; giver: string; receiver: string }>(
    `SELECT h.ano, g.name AS giver, r.name AS receiver FROM secret_santa_history h
     JOIN participants g ON g.id = h.giver_participant_id JOIN participants r ON r.id = h.receiver_participant_id
     WHERE NOT EXISTS (SELECT 1 FROM secret_santa_history hidden WHERE hidden.ano = h.ano AND hidden.revelado IS FALSE)
     ORDER BY h.ano DESC, lower(g.name), g.id`,
  );
  return { history: rows };
}
export async function loadLive() {
  // JSON de ordem é aberto somente no servidor. O filtro SQL impede serializar pares futuros.
  const { rows } = await query<{ atual: number; total: number; iniciado_em: string; encerrado_em: string | null; pairs: { giver_id: number; receiver_id: number; giver: string; receiver: string; acertos: string[] }[] }>(
    `SELECT l.atual, jsonb_array_length(l.ordem) AS total, l.iniciado_em, l.encerrado_em,
       COALESCE((SELECT jsonb_agg(jsonb_build_object(
         'giver_id', g.id, 'receiver_id', r.id, 'giver', g.name, 'receiver', r.name,
         'acertos', (SELECT COALESCE(jsonb_agg(p.name), '[]'::jsonb) FROM secret_santa_guesses guess
           JOIN participants p ON p.id = guess.participant_id WHERE guess.config_id = l.config_id
             AND guess.participant_id = r.id AND guess.guessed_participant_id = g.id)
       ) ORDER BY pair.pos) FROM jsonb_array_elements(l.ordem) WITH ORDINALITY pair(value, pos)
        JOIN participants g ON g.id = (pair.value->>'giver_id')::int
        JOIN participants r ON r.id = (pair.value->>'receiver_id')::int
        WHERE pair.pos <= l.atual + 1), '[]'::jsonb) AS pairs
     FROM secret_santa_live l WHERE l.ano = $1`, [edicaoAtual()],
  );
  const live = rows[0];
  if (!live) return { live: null };
  // Defesa adicional: nem uma ampliação futura do SELECT pode publicar a ordem completa.
  return { live: {
    atual: live.atual, total: live.total, iniciado_em: live.iniciado_em, encerrado_em: live.encerrado_em,
    pairs: live.pairs.slice(0, Math.max(0, live.atual + 1)).map(p => ({
      giver_id: p.giver_id, receiver_id: p.receiver_id, giver: p.giver, receiver: p.receiver, acertos: p.acertos,
    })),
  } };
}

export async function loadSanta(me: SessionUser) {
  const { canReveal, loadActiveConfig, loadMyDraw } = await import('./shared');
  const config = await loadActiveConfig();
  const can_reveal = canReveal(config);
  const mine = config && me.participant_id ? await loadMyDraw(me.participant_id, config.id) : null;
  return { config, can_reveal, reveal_opens_at: config?.reveal_date ?? null, participating: !!mine,
    draw: mine ? can_reveal && mine.revealed && mine.receiver ? { revealed: true, receiver: mine.receiver } : { revealed: false } : null };
}
