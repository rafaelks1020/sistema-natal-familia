import { HttpError, ok, readJson, requireUser, route, toInt } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import {
  parseItemDescription,
  parseItemName,
  parseItemUrl,
  parsePriority,
  presentWish,
  WISH_RETURNING,
  WishRow,
} from '../shared';

// PUT    /api/wishlist/[id]  dono edita o texto; outra pessoa logada marca purchased
// DELETE /api/wishlist/[id]  dono ou quem organiza

export const dynamic = 'force-dynamic';

const TEXT_KEYS = ['item_name', 'item_description', 'item_url', 'priority'] as const;

async function loadItem(id: number): Promise<WishRow> {
  const { rows } = await query<WishRow>(
    `SELECT ${WISH_RETURNING} FROM wish_list WHERE id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row) throw new HttpError(404, 'Desejo não encontrado.');
  return row;
}

export const PUT = route<{ params: Promise<{ id: string }> }>(async (req, ctx) => {
  const me = await requireUser();
  const { id: raw } = await ctx.params;
  const id = toInt(raw, 'desejo');
  const current = await loadItem(id);
  const body = await readJson<Record<string, unknown>>(req);

  const wantsText = TEXT_KEYS.some((key) => key in body);
  const wantsBuy = 'purchased' in body;
  if (!wantsText && !wantsBuy) throw new HttpError(400, 'Nada para salvar.');

  const isOwner = me.participant_id != null && current.participant_id === me.participant_id;
  if (wantsText && !isOwner) throw new HttpError(403, 'Só quem escreveu pode mudar o texto.');
  if (wantsBuy && isOwner) {
    throw new HttpError(403, 'Quem pediu o presente não marca a compra. É surpresa.');
  }
  if (wantsBuy && typeof body.purchased !== 'boolean') {
    throw new HttpError(400, 'Marque se já comprou ou não.');
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  const add = (column: string, value: unknown) => {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };

  if ('item_name' in body) add('item_name', parseItemName(body.item_name));
  if ('item_description' in body) add('item_description', parseItemDescription(body.item_description));
  if ('item_url' in body) add('item_url', parseItemUrl(body.item_url));
  if ('priority' in body) add('priority', parsePriority(body.priority));
  if (wantsBuy && !isOwner) add('purchased', body.purchased);
  if (!sets.length) throw new HttpError(400, 'Nada para salvar.');

  params.push(id);
  const { rows } = await query<WishRow>(
    `UPDATE wish_list SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${WISH_RETURNING}`,
    params,
  );
  return ok(presentWish(rows[0], me.participant_id));
});

export const DELETE = route<{ params: Promise<{ id: string }> }>(async (_req, ctx) => {
  const me = await requireUser();
  const { id: raw } = await ctx.params;
  const id = toInt(raw, 'desejo');
  const current = await loadItem(id);
  const isOwner = me.participant_id != null && current.participant_id === me.participant_id;
  if (!isOwner && !me.is_admin) {
    throw new HttpError(403, 'Só quem escreveu este desejo pode apagar.');
  }
  await query('DELETE FROM wish_list WHERE id = $1', [id]);
  return ok({ ok: true });
});
