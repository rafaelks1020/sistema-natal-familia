import { query } from '@/app/lib/db';
import { HttpError, ok, requireAdmin, route, toInt } from '@/app/lib/api';

// DELETE /api/invites/<id> (organizador) -> cancela o convite (o link para de funcionar).
export const DELETE = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  await requireAdmin();
  const id = toInt((await params).id);
  const { rowCount } = await query('UPDATE invites SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL', [id]);
  if (!rowCount) throw new HttpError(404, 'Convite não encontrado ou já cancelado.');
  return ok({ ok: true });
});
