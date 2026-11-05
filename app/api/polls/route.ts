import { query } from '@/app/lib/db';
import { HttpError, cleanText, ok, readJson, requireUser, route } from '@/app/lib/api';

// GET  /api/polls -> [{ id, question, options, votes:number[], my_vote, total, created_by, created_by_name, created_by_avatar, created_at }]
// POST /api/polls { question, options (2 a 5) }

export const GET = route(async () => {
  const me = await requireUser();

  const { rows } = await query(
    `SELECT
       p.id,
       p.question,
       p.options,
       p.created_by,
       u.name AS created_by_name,
       u.avatar_url AS created_by_avatar,
       p.created_at,
       COALESCE(v.votes_by_option, '{}'::jsonb) AS votes_by_option,
       mv.option_index AS my_vote
     FROM family_polls p
     JOIN family_users u ON u.id = p.created_by
     LEFT JOIN LATERAL (
       SELECT jsonb_object_agg(option_index::text, cnt) AS votes_by_option
       FROM (
         SELECT option_index, COUNT(*)::int AS cnt
         FROM family_poll_votes
         WHERE poll_id = p.id
         GROUP BY option_index
       ) x
     ) v ON TRUE
     LEFT JOIN family_poll_votes mv
       ON mv.poll_id = p.id AND mv.user_id = $1
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT 30`,
    [me.id],
  );

  const polls = rows.map((row) => {
    const options: string[] = Array.isArray(row.options) ? row.options.map(String) : [];
    const votesMap = (row.votes_by_option ?? {}) as Record<string, number>;
    const votes = options.map((_, idx) => Number(votesMap[String(idx)] ?? 0));
    const total = votes.reduce((acc, n) => acc + n, 0);
    return {
      id: Number(row.id),
      question: String(row.question),
      options,
      votes,
      my_vote: row.my_vote !== null && row.my_vote !== undefined ? Number(row.my_vote) : null,
      total,
      created_by: Number(row.created_by),
      created_by_name: String(row.created_by_name),
      created_by_avatar: row.created_by_avatar ?? null,
      created_at: row.created_at,
    };
  });

  return ok(polls);
});

export const POST = route(async (req) => {
  const me = await requireUser();
  const body = await readJson<Record<string, unknown>>(req);

  const question = cleanText(body.question, 'a pergunta da enquete', 240);
  if (!Array.isArray(body.options)) {
    throw new HttpError(400, 'Informe as opções da enquete.');
  }

  const options = body.options
    .map((o) => (typeof o === 'string' ? o.trim() : ''))
    .filter((o) => o.length > 0);

  if (options.length < 2 || options.length > 5) {
    throw new HttpError(400, 'A enquete precisa ter entre 2 e 5 opções.');
  }
  for (const opt of options) {
    if (opt.length > 120) {
      throw new HttpError(400, 'Cada opção pode ter no máximo 120 caracteres.');
    }
  }

  const { rows } = await query(
    `INSERT INTO family_polls (question, options, created_by)
     VALUES ($1, $2, $3)
     RETURNING id, question, options, created_by, created_at`,
    [question, options, me.id],
  );

  const row = rows[0];
  return ok(
    {
      id: Number(row.id),
      question: String(row.question),
      options,
      votes: options.map(() => 0),
      my_vote: null,
      total: 0,
      created_by: me.id,
      created_by_name: me.name,
      created_by_avatar: me.avatar_url,
      created_at: row.created_at,
    },
    201,
  );
});
