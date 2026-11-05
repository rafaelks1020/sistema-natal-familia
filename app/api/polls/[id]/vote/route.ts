import { query } from '@/app/lib/db';
import { HttpError, ok, readJson, requireUser, route, toInt } from '@/app/lib/api';

// POST /api/polls/[id]/vote { option_index } (upsert, pode trocar)

type ParamsCtx = { params: Promise<{ id: string }> };

export const POST = route<ParamsCtx>(async (req, { params }) => {
  const me = await requireUser();
  const { id } = await params;
  const pollId = toInt(id, 'id');

  const body = await readJson<Record<string, unknown>>(req);
  const optionIndex = Number(body.option_index);

  const pollRes = await query<{ id: number; options: string[] }>(
    'SELECT id, options FROM family_polls WHERE id = $1',
    [pollId],
  );
  const poll = pollRes.rows[0];
  if (!poll) {
    throw new HttpError(404, 'Enquete não encontrada.');
  }

  const options = Array.isArray(poll.options) ? poll.options : [];
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= options.length) {
    throw new HttpError(400, 'Opção de voto inválida.');
  }

  await query(
    `INSERT INTO family_poll_votes (poll_id, user_id, option_index)
     VALUES ($1, $2, $3)
     ON CONFLICT (poll_id, user_id)
     DO UPDATE SET option_index = EXCLUDED.option_index, created_at = NOW()`,
    [pollId, me.id, optionIndex],
  );

  const countsRes = await query<{ option_index: number; cnt: number }>(
    `SELECT option_index, COUNT(*)::int AS cnt
       FROM family_poll_votes
      WHERE poll_id = $1
      GROUP BY option_index`,
    [pollId],
  );

  const votes = options.map(() => 0);
  for (const r of countsRes.rows) {
    const idx = Number(r.option_index);
    if (idx >= 0 && idx < votes.length) {
      votes[idx] = Number(r.cnt);
    }
  }
  const total = votes.reduce((acc, n) => acc + n, 0);

  return ok({
    id: pollId,
    votes,
    my_vote: optionIndex,
    total,
  });
});
