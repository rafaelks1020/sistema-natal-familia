import { query } from '@/app/lib/db';
import { HttpError, ok, readJson, requireAdmin, route, toInt } from '@/app/lib/api';

type RouteContext = { params: Promise<{ id: string }> };

export const PUT = route<RouteContext>(async (req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const participantId = toInt(id, 'id');
  const body = await readJson<{ paid?: unknown }>(req);

  if (typeof body.paid !== 'boolean') {
    throw new HttpError(400, 'Informe se o pagamento foi feito.');
  }

  const { rows } = await query<{
    id: number;
    name: string;
    paid: boolean;
    paid_date: Date | string | null;
    user_id: number | null;
  }>(
    `UPDATE participants
        SET paid = $1,
            paid_date = CASE WHEN $1 THEN NOW() ELSE NULL END
      WHERE id = $2
      RETURNING id, name, paid, paid_date, user_id`,
    [body.paid, participantId],
  );

  if (!rows.length) {
    throw new HttpError(404, 'Participante não encontrado.');
  }

  const row = rows[0];
  return ok({
    id: row.id,
    name: row.name,
    paid: Boolean(row.paid),
    paid_date: row.paid_date ? new Date(row.paid_date).toISOString() : null,
    user_id: row.user_id ?? null,
  });
});

export const DELETE = route<RouteContext>(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const participantId = toInt(id, 'id');

  const existing = await query<{ id: number; user_id: number | null }>(
    `SELECT id, user_id FROM participants WHERE id = $1`,
    [participantId],
  );

  if (!existing.rows.length) {
    throw new HttpError(404, 'Participante não encontrado.');
  }

  if (existing.rows[0].user_id !== null) {
    throw new HttpError(400, 'Esse parente tem acesso; remova pelo cadastro');
  }

  await query(`DELETE FROM participants WHERE id = $1`, [participantId]);
  return ok({ ok: true });
});
