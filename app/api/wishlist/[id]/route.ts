import { HttpError, ok, readJson, requireUser, route, toInt } from '@/app/lib/api';
import { query, transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import {
  notificarListaAlterada,
  parseImageUrl,
  parseItemDescription,
  parseItemName,
  parseItemUrl,
  parsePriceCents,
  parsePriority,
  presentWish,
  validatePriceRange,
  WISH_RETURNING,
  WishRow,
} from '../shared';

// PUT    /api/wishlist/[id]  dono edita o desejo; outra pessoa logada marca purchased em wish_list_compras
// DELETE /api/wishlist/[id]  dono ou quem organiza

export const dynamic = 'force-dynamic';

const TEXT_KEYS = [
  'item_name',
  'item_description',
  'item_url',
  'priority',
  'price_min_cents',
  'price_max_cents',
  'preco_min_centavos',
  'preco_max_centavos',
  'image_url',
  'foto_url',
] as const;

async function loadItem(id: number, viewerUserId: number): Promise<WishRow> {
  const { rows } = await query<WishRow>(
    `SELECT w.id, w.ano, w.participant_id, w.config_id, w.item_name, w.item_description,
            w.item_url, w.priority, w.price_min_cents, w.price_max_cents, w.image_url,
            (w.purchased IS TRUE OR EXISTS (
              SELECT 1 FROM wish_list_compras c WHERE c.wish_id = w.id
            )) AS purchased,
            EXISTS (
              SELECT 1 FROM wish_list_compras c WHERE c.wish_id = w.id AND c.user_id = $2
            ) AS purchased_by_me,
            w.created_at
       FROM wish_list w
      WHERE w.id = $1`,
    [id, viewerUserId],
  );
  const row = rows[0];
  if (!row) throw new HttpError(404, 'Desejo não encontrado.');
  return row;
}

export const PUT = route<{ params: Promise<{ id: string }> }>(async (req, ctx) => {
  const me = await requireUser();
  const { id: raw } = await ctx.params;
  const id = toInt(raw, 'desejo');
  const current = await loadItem(id, me.id);
  const body = await readJson<Record<string, unknown>>(req);

  const wantsText = TEXT_KEYS.some((key) => key in body);
  const wantsBuy = 'purchased' in body;
  if (!wantsText && !wantsBuy) throw new HttpError(400, 'Nada para salvar.');

  const isOwner = me.participant_id != null && current.participant_id === me.participant_id;
  if (wantsText && !isOwner) throw new HttpError(403, 'Só quem escreveu pode mudar o desejo.');
  if (wantsBuy && isOwner) {
    throw new HttpError(403, 'Quem pediu o presente não marca a compra. É surpresa.');
  }
  if (wantsBuy && typeof body.purchased !== 'boolean') {
    throw new HttpError(400, 'Marque se já comprou ou não.');
  }

  if (wantsBuy && !isOwner) {
    const blocked = await query(
      `SELECT 1
         FROM participants p
         JOIN user_blocks b ON (b.blocker_id = $1 AND b.blocked_id = p.user_id)
                            OR (b.blocker_id = p.user_id AND b.blocked_id = $1)
        WHERE p.id = $2`,
      [me.id, current.participant_id],
    );
    if (blocked.rows.length > 0) {
      throw new HttpError(403, 'Você não pode alterar esta lista.');
    }

    const bought = body.purchased === true;
    const ano = edicaoAtual();
    await transaction(async (q) => {
      if (bought) {
        await q(
          `INSERT INTO wish_list_compras (ano, wish_id, user_id, created_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (wish_id, user_id) DO NOTHING`,
          [ano, id, me.id],
        );
        await q('UPDATE wish_list SET purchased = true WHERE id = $1', [id]);
      } else {
        const deleted = await q(
          'DELETE FROM wish_list_compras WHERE wish_id = $1 AND user_id = $2 RETURNING id',
          [id, me.id],
        );
        if (!deleted.rows.length) {
          const other = await q<{ n: number }>(
            'SELECT count(*)::int AS n FROM wish_list_compras WHERE wish_id = $1',
            [id],
          );
          if ((other.rows[0]?.n ?? 0) > 0) {
            if (me.is_admin) {
              await q('DELETE FROM wish_list_compras WHERE wish_id = $1', [id]);
            } else {
              throw new HttpError(409, 'Outra pessoa da família já marcou que comprou este presente.');
            }
          }
        }
        await q(
          `UPDATE wish_list
              SET purchased = EXISTS (SELECT 1 FROM wish_list_compras WHERE wish_id = $1)
            WHERE id = $1`,
          [id],
        );
      }
    });

    const updated = await loadItem(id, me.id);
    return ok(presentWish(updated, me.participant_id));
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

  const hasMin = 'price_min_cents' in body || 'preco_min_centavos' in body;
  const hasMax = 'price_max_cents' in body || 'preco_max_centavos' in body;
  const nextMin = hasMin
    ? parsePriceCents(
        'price_min_cents' in body ? body.price_min_cents : body.preco_min_centavos,
        'o valor mínimo',
      )
    : current.price_min_cents;
  const nextMax = hasMax
    ? parsePriceCents(
        'price_max_cents' in body ? body.price_max_cents : body.preco_max_centavos,
        'o valor máximo',
      )
    : current.price_max_cents;
  if (hasMin || hasMax) {
    validatePriceRange(nextMin, nextMax);
    if (hasMin) add('price_min_cents', nextMin);
    if (hasMax) add('price_max_cents', nextMax);
  }

  const hasImage = 'image_url' in body || 'foto_url' in body;
  if (hasImage) {
    const rawImg = 'image_url' in body ? body.image_url : body.foto_url;
    add('image_url', parseImageUrl(rawImg));
  }

  if (!sets.length) throw new HttpError(400, 'Nada para salvar.');

  params.push(id);
  const { rows } = await query<WishRow>(
    `UPDATE wish_list SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${WISH_RETURNING}`,
    params,
  );

  await notificarListaAlterada(current.participant_id, current.config_id);

  return ok(presentWish(rows[0], me.participant_id));
});

export const DELETE = route<{ params: Promise<{ id: string }> }>(async (_req, ctx) => {
  const me = await requireUser();
  const { id: raw } = await ctx.params;
  const id = toInt(raw, 'desejo');
  const current = await loadItem(id, me.id);
  const isOwner = me.participant_id != null && current.participant_id === me.participant_id;
  if (!isOwner && !me.is_admin) {
    throw new HttpError(403, 'Só quem escreveu este desejo pode apagar.');
  }
  await query('DELETE FROM wish_list WHERE id = $1', [id]);
  if (isOwner) {
    await notificarListaAlterada(current.participant_id, current.config_id);
  }
  return ok({ ok: true });
});
