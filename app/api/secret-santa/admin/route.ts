import { enviarPush } from '@/app/lib/push';
import { randomBytes } from 'crypto';
import { HttpError, ok, readJson, requireAdmin, route, toInt } from '@/app/lib/api';
import { query, transaction } from '@/app/lib/db';
import { drawSecretSanta, DrawRule, DrawResult } from '@/app/lib/secretSanta';
import { edicaoAtual } from '@/app/lib/edicao';
import { loadActiveConfig, mapConfig } from '../shared';

// GET    /api/secret-santa/admin  -> { config, participants, status } sem os pares
// POST   /api/secret-santa/admin  -> { action:'draw', participant_ids, valores, rules }
// DELETE /api/secret-santa/admin  -> desativa o sorteio ativo

export const dynamic = 'force-dynamic';

interface ParticipantRow {
  id: number;
  name: string;
  has_login: boolean;
}

interface StatusRow {
  name: string;
  revealed: boolean | null;
}

async function loadParticipants() {
  const { rows } = await query<ParticipantRow>(
    `SELECT id, name, (user_id IS NOT NULL) AS has_login
       FROM participants
      ORDER BY lower(name), id`,
  );
  return rows.map((p) => ({ id: p.id, name: p.name, has_login: p.has_login === true }));
}

async function loadStatus(configId: number | null) {
  if (!configId) return [];
  const { rows } = await query<StatusRow>(
    `SELECT g.name, d.revealed
       FROM secret_santa_draws d
       JOIN participants g ON g.id = d.giver_id
      WHERE d.config_id = $1
      ORDER BY lower(g.name), g.id`,
    [configId],
  );
  return rows.map((r) => ({ name: r.name, revealed: r.revealed === true }));
}

export const GET = route(async () => {
  await requireAdmin();
  const config = await loadActiveConfig();
  const [participants, status] = await Promise.all([
    loadParticipants(),
    loadStatus(config?.id ?? null),
  ]);
  return ok({ config, participants, status });
});

function parseIdList(value: unknown): number[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new HttpError(400, 'Escolha as pessoas do sorteio.');
  }
  if (value.length > 200) throw new HttpError(400, 'Muitas pessoas de uma vez.');
  const ids = value.map((v) => toInt(v, 'participante'));
  const unique = [...new Set(ids)];
  if (unique.length < 3) throw new HttpError(400, 'O sorteio precisa de pelo menos 3 pessoas.');
  return unique;
}

function parseMoney(value: unknown, field: string): number {
  let n = Number.NaN;
  if (typeof value === 'number') n = value;
  else if (typeof value === 'string') {
    const t = value.trim();
    const norm = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
    n = Number(norm);
  }
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
    throw new HttpError(400, `${field} inválido.`);
  }
  return Math.round(n * 100) / 100;
}

function parseRevealDate(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value.trim())) {
    throw new HttpError(400, 'Data da revelação inválida.');
  }
  const day = value.trim().slice(0, 10);
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    throw new HttpError(400, 'Data da revelação inválida.');
  }
  return day;
}

function parseRules(value: unknown, allowed: Set<number>): DrawRule[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new HttpError(400, 'Regras inválidas.');
  if (value.length > 100) throw new HttpError(400, 'Regras demais.');
  const out: DrawRule[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') throw new HttpError(400, 'Regra inválida.');
    const rule = raw as Record<string, unknown>;
    if (rule.type !== 'cannot_draw') throw new HttpError(400, 'Tipo de regra desconhecido.');
    const a = toInt(rule.participant1_id, 'pessoa da regra');
    const b = toInt(rule.participant2_id, 'pessoa da regra');
    if (a === b) throw new HttpError(400, 'Uma pessoa não entra numa regra com ela mesma.');
    if (!allowed.has(a) || !allowed.has(b)) {
      throw new HttpError(400, 'A regra só vale para quem está no sorteio.');
    }
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ type: 'cannot_draw', participant1_id: a, participant2_id: b });
  }
  return out;
}

function assertDraw(draws: { giver_id: number; receiver_id: number }[], peopleIds: Set<number>, rules: DrawRule[]) {
  if (draws.length !== peopleIds.size) {
    throw new HttpError(400, 'Não foi possível sortear com essas regras.');
  }
  const givers = new Set<number>();
  const receivers = new Set<number>();
  for (const draw of draws) {
    if (draw.giver_id === draw.receiver_id || !peopleIds.has(draw.giver_id) || !peopleIds.has(draw.receiver_id)) {
      throw new HttpError(400, 'O sorteio saiu inválido. Tente de novo.');
    }
    if (givers.has(draw.giver_id) || receivers.has(draw.receiver_id)) {
      throw new HttpError(400, 'O sorteio saiu inválido. Tente de novo.');
    }
    givers.add(draw.giver_id);
    receivers.add(draw.receiver_id);
  }
  for (const rule of rules) {
    const broken = draws.some((d) =>
      (d.giver_id === rule.participant1_id && d.receiver_id === rule.participant2_id)
      || (d.giver_id === rule.participant2_id && d.receiver_id === rule.participant1_id));
    if (broken) throw new HttpError(400, 'O sorteio não respeitou uma regra. Tente de novo.');
  }
}

export const POST = route(async (req) => {
  await requireAdmin();
  const body = await readJson<Record<string, unknown>>(req);
  if (body.action !== 'draw') throw new HttpError(400, 'Ação desconhecida.');

  const ids = parseIdList(body.participant_ids);
  if (body.min_gift_value == null || body.min_gift_value === '' || body.max_gift_value == null || body.max_gift_value === '') {
    throw new HttpError(400, 'Informe o valor mínimo e o máximo do presente.');
  }
  const min = parseMoney(body.min_gift_value, 'Valor mínimo');
  const max = parseMoney(body.max_gift_value, 'Valor máximo');
  if (min > max) throw new HttpError(400, 'O valor mínimo passou do máximo.');
  const revealDate = parseRevealDate(body.reveal_date);
  const allowed = new Set(ids);
  const rules = parseRules(body.rules, allowed);

  const { rows } = await query<{ id: number; name: string }>(
    'SELECT id, name FROM participants WHERE id = ANY($1::int[])',
    [ids],
  );
  if (rows.length !== ids.length) {
    throw new HttpError(400, 'Alguma pessoa escolhida não está mais na família.');
  }
  const people = [...rows].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.id - b.id);

  const { createdConfig, userIds } = await transaction(async (q) => {
    // Trava a transação (qualquer usuário do banco pode), para dois sorteios não ficarem ativos juntos.
    await q('SELECT pg_advisory_xact_lock(714203)');
    const live = await q('SELECT 1 FROM secret_santa_live WHERE ano = $1', [edicaoAtual()]);
    if (live.rows.length) throw new HttpError(409, 'A revelação ao vivo já começou. O sorteio está protegido.');
    const still = await q<{ id: number; user_id: number | null }>(
      'SELECT id, user_id FROM participants WHERE id = ANY($1::int[])',
      [ids],
    );
    if (still.rows.length !== ids.length) {
      throw new HttpError(400, 'Alguma pessoa saiu da lista. Tente de novo.');
    }
    const previous = await q<{ id: number; ano: number }>(
      'SELECT id, ano FROM secret_santa_config ORDER BY ano DESC, created_at DESC, id DESC LIMIT 1',
    );
    const previousId = previous.rows[0]?.id ?? null;
    if (previousId && previous.rows[0].ano === edicaoAtual() && body.force !== true) {
      const opened = await q(
        'SELECT 1 FROM secret_santa_draws WHERE config_id = $1 AND revealed IS TRUE LIMIT 1',
        [previousId],
      );
      if (opened.rows.length) {
        throw new HttpError(409, 'Já tem gente que viu quem tirou. Para refazer mesmo assim, confirme.');
      }
    }
    const previousConfig = previous.rows[0];
    if (previousConfig && previousConfig.ano < edicaoAtual()) {
      // Não substitui um ano cadastrado manualmente. Arquiva inclusive sorteios ainda secretos.
      const archived = await q('SELECT 1 FROM secret_santa_history WHERE ano = $1 LIMIT 1', [previousConfig.ano]);
      if (!archived.rows.length) await q(
        `INSERT INTO secret_santa_history(ano,giver_participant_id,receiver_participant_id,revelado)
         SELECT $1,giver_id,receiver_id,
           (SELECT bool_and(revealed IS TRUE) FROM secret_santa_draws WHERE config_id = $2)
         FROM secret_santa_draws WHERE config_id = $2`, [previousConfig.ano, previousConfig.id]);
    }
    const setting = await q<{ value: string }>("SELECT value FROM app_settings WHERE key = 'amigo_evitar_repeticao'");
    const avoid = setting.rows[0]?.value !== 'false';
    const history = await q<DrawResult>(
      'SELECT giver_participant_id AS giver_id, receiver_participant_id AS receiver_id FROM secret_santa_history WHERE ano = $1', [edicaoAtual() - 1]);
    const draws = drawSecretSanta(people, rules, avoid && body.confirm_without_previous !== true ? history.rows : []);
    if (!draws && avoid && history.rows.length && body.confirm_without_previous !== true) {
      const possible = drawSecretSanta(people, rules);
      if (possible) throw new HttpError(422, 'Não foi possível evitar os pares do ano anterior. Confirme para sortear sem essa regra.');
    }
    if (!draws) throw new HttpError(400, 'Não foi possível sortear com essas regras. Revise as restrições.');
    assertDraw(draws, new Set(people.map(p => p.id)), rules);
    if (avoid && body.confirm_without_previous !== true && draws.some(d => history.rows.some(h => h.giver_id === d.giver_id && h.receiver_id === d.receiver_id))) {
      throw new HttpError(400, 'O sorteio repetiu um par anterior. Revise as regras.');
    }
    await q('DELETE FROM secret_santa_hints WHERE ano = $1', [edicaoAtual()]);
    await q('DELETE FROM secret_santa_guesses WHERE ano = $1', [edicaoAtual()]);
    await q('UPDATE secret_santa_config SET is_active = false WHERE is_active IS TRUE');
    const created = await q<{
      id: number;
      min_gift_value: unknown;
      max_gift_value: unknown;
      reveal_date: string | null;
    }>(
      `INSERT INTO secret_santa_config (is_active, min_gift_value, max_gift_value, reveal_date, rules, ano)
       VALUES (true, $1, $2, $3, $4::jsonb, $5)
       RETURNING id,
                 min_gift_value::float8 AS min_gift_value,
                 max_gift_value::float8 AS max_gift_value,
                 to_char(reveal_date, 'YYYY-MM-DD') AS reveal_date`,
      [min, max, revealDate, JSON.stringify(rules), edicaoAtual()],
    );
    const row = created.rows[0];
    for (const draw of draws) {
      // token é NOT NULL e UNIQUE. 16 bytes em hex, sem ir para o cliente.
      const token = randomBytes(16).toString('hex');
      await q(
        `INSERT INTO secret_santa_draws (config_id, giver_id, receiver_id, token)
         VALUES ($1, $2, $3, $4)`,
        [row.id, draw.giver_id, draw.receiver_id, token],
      );
    }
    if (previousId) {
      // Uma nova distribuição de pares começa sem compras marcadas.
      await q(
        `INSERT INTO wish_list (ano, participant_id, config_id, item_name, item_description, item_url, priority, price_min_cents, price_max_cents, image_url, purchased, created_at)
         SELECT DISTINCT $4, w.participant_id, $1, w.item_name, w.item_description, w.item_url, w.priority, w.price_min_cents, w.price_max_cents, w.image_url, false, w.created_at
           FROM wish_list w
          WHERE w.config_id = $2 AND w.participant_id = ANY($3::int[])
            AND NOT EXISTS (
              SELECT 1 FROM wish_list copied
               WHERE copied.config_id = $1 AND copied.participant_id = w.participant_id
                 AND copied.item_name = w.item_name
                 AND copied.item_description IS NOT DISTINCT FROM w.item_description
                 AND copied.item_url IS NOT DISTINCT FROM w.item_url
                 AND copied.priority IS NOT DISTINCT FROM w.priority
                 AND copied.price_min_cents IS NOT DISTINCT FROM w.price_min_cents
                 AND copied.price_max_cents IS NOT DISTINCT FROM w.price_max_cents
                 AND copied.image_url IS NOT DISTINCT FROM w.image_url
                 AND copied.created_at IS NOT DISTINCT FROM w.created_at
            )`,
        [row.id, previousId, ids, edicaoAtual()],
      );
    }
    return {
      createdConfig: mapConfig(row),
      userIds: still.rows.flatMap((p) => p.user_id === null ? [] : [p.user_id]),
    };
  });

  void enviarPush(userIds, {
    titulo: 'Amigo oculto', corpo: 'O sorteio saiu! Toque para descobrir quem você tirou.', rota: '/amigo-oculto',
  });
  return ok({ ok: true, config: createdConfig });
});

export const DELETE = route(async () => {
  await requireAdmin();
  await transaction(async (q) => {
    await q('SELECT pg_advisory_xact_lock(714203)');
    const live = await q('SELECT 1 FROM secret_santa_live WHERE ano = $1', [edicaoAtual()]);
    if (live.rows.length) throw new HttpError(409, 'A revelação ao vivo já começou. O sorteio está protegido.');
    await q('UPDATE secret_santa_config SET is_active = false WHERE is_active IS TRUE');
  });
  return ok({ ok: true });
});
