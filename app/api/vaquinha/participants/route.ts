import { query } from '@/app/lib/db';
import { cleanText, ok, readJson, requireAdmin, route } from '@/app/lib/api';

export const POST = route(async (req) => {
  await requireAdmin();
  const body = await readJson<{ name?: unknown }>(req);
  const name = cleanText(body.name, 'o nome do participante', 60);

  const { rows } = await query<{
    id: number;
    name: string;
    paid: boolean;
    paid_date: Date | string | null;
    user_id: number | null;
  }>(
    `INSERT INTO participants (name)
     VALUES ($1)
     RETURNING id, name, paid, paid_date, user_id`,
    [name],
  );

  const row = rows[0];
  return ok(
    {
      id: row.id,
      name: row.name,
      paid: Boolean(row.paid),
      paid_date: row.paid_date ? new Date(row.paid_date).toISOString() : null,
      user_id: row.user_id ?? null,
      avatar_url: null,
    },
    201,
  );
});
