import { transaction } from '@/app/lib/db';
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

  const row = await transaction(async (q) => {
    if (body.paid === false) {
      const pix = await q(
        `SELECT 1 FROM payments WHERE participant_id = $1 AND status = 'PAID' LIMIT 1`,
        [participantId],
      );
      if (pix.rows.length) {
        throw new HttpError(409, 'Pago pelo Pix: não dá para desmarcar.');
      }
    }

    const { rows } = await q<{
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
    return rows[0] ?? null;
  });

  if (!row) {
    throw new HttpError(404, 'Participante não encontrado.');
  }
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

  await transaction(async (q) => {
    const existing = await q<{ id: number; user_id: number | null }>(
      `SELECT id, user_id FROM participants WHERE id = $1`,
      [participantId],
    );

    if (!existing.rows.length) {
      throw new HttpError(404, 'Participante não encontrado.');
    }

    const draw = await q(
      `SELECT 1
         FROM secret_santa_draws d
         JOIN secret_santa_config c ON c.id = d.config_id
        WHERE c.is_active IS TRUE
          AND (d.giver_id = $1 OR d.receiver_id = $1)
        LIMIT 1`,
      [participantId],
    );
    if (draw.rows.length) {
      throw new HttpError(409, 'Está no sorteio ativo: refaça o sorteio antes.');
    }

    if (existing.rows[0].user_id !== null) {
      throw new HttpError(400, 'Esse parente tem acesso; remova pelo cadastro');
    }

    await q(`DELETE FROM participants WHERE id = $1`, [participantId]);
  });
  return ok({ ok: true });
});
