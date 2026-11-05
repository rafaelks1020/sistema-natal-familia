import { query } from '@/app/lib/db';
import { HttpError, ok, requireAdmin, route, toInt } from '@/app/lib/api';

// POST /api/posts/[id]/pin (admin) -> alterna pinned

type ParamsCtx = { params: Promise<{ id: string }> };

export const POST = route<ParamsCtx>(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const postId = toInt(id, 'id');

  const { rows } = await query<{ id: number; pinned: boolean }>(
    `UPDATE family_posts
        SET pinned = NOT COALESCE(pinned, false),
            updated_at = NOW()
      WHERE id = $1
      RETURNING id, pinned`,
    [postId],
  );

  const row = rows[0];
  if (!row) {
    throw new HttpError(404, 'Publicação não encontrada.');
  }

  return ok({ id: Number(row.id), pinned: Boolean(row.pinned) });
});
