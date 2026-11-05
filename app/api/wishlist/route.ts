import { HttpError, ok, readJson, requireUser, route, toInt } from '@/app/lib/api';
import { query } from '@/app/lib/db';
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
  resolveWishlistConfigId,
  validatePriceRange,
  WISH_RETURNING,
  WishParticipant,
  WishRow,
} from './shared';

// GET  /api/wishlist?participant_id=N   (sem param = a minha)
//      { items, config_id, participants }
//      config ativo; se não houver, o último config criado; se não houver nenhum, items [].
//      O dono NUNCA recebe o campo purchased nem purchased_by_me.
// POST /api/wishlist  { item_name, item_description?, item_url?, priority, price_min_cents?, price_max_cents?, image_url? }
//      grava em me.participant_id e avisa quem tirou (no máx. 1 vez a cada 6 h).

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const me = await requireUser();
  const url = new URL(req.url);
  const raw = url.searchParams.get('participant_id');

  let participantId: number | null;
  if (raw == null || raw === '') {
    participantId = me.participant_id;
  } else {
    participantId = toInt(raw, 'participante');
    const found = await query<{ user_id: number | null }>(
      'SELECT user_id FROM participants WHERE id = $1',
      [participantId],
    );
    if (!found.rows.length) throw new HttpError(404, 'Pessoa não encontrada.');
    const ownerUserId = found.rows[0].user_id;
    if (ownerUserId && ownerUserId !== me.id) {
      const blocked = await query(
        `SELECT 1 FROM user_blocks
          WHERE (blocker_id = $1 AND blocked_id = $2)
             OR (blocker_id = $2 AND blocked_id = $1)`,
        [me.id, ownerUserId],
      );
      if (blocked.rows.length > 0) {
        return ok({ items: [], config_id: null, participants: [] });
      }
    }
  }

  const configId = await resolveWishlistConfigId();
  if (!configId) {
    return ok({ items: [], config_id: null, participants: [] });
  }

  const { rows: participants } = await query<WishParticipant>(
    `SELECT p.id, p.name, u.avatar_url,
            COUNT(w.id)::int AS wish_count
       FROM participants p
       LEFT JOIN family_users u ON u.id = p.user_id
       LEFT JOIN wish_list w ON w.participant_id = p.id AND w.config_id = $1
      WHERE ($2::int IS NULL OR p.id <> $2)
        AND NOT EXISTS (
          SELECT 1 FROM user_blocks b
           WHERE p.user_id IS NOT NULL
             AND ((b.blocker_id = $3 AND b.blocked_id = p.user_id)
               OR (b.blocker_id = p.user_id AND b.blocked_id = $3))
        )
      GROUP BY p.id, p.name, u.avatar_url
      ORDER BY (COUNT(w.id) > 0) DESC, p.name ASC`,
    [configId, me.participant_id, me.id],
  );

  if (!participantId) {
    return ok({ items: [], config_id: configId, participants });
  }

  const { rows } = await query<WishRow>(
    `SELECT w.id, w.ano, w.participant_id, w.config_id, w.item_name, w.item_description,
            w.item_url, w.priority, w.price_min_cents, w.price_max_cents, w.image_url,
            (w.purchased IS TRUE OR EXISTS (
              SELECT 1 FROM wish_list_compras c WHERE c.wish_id = w.id
            )) AS purchased,
            EXISTS (
              SELECT 1 FROM wish_list_compras c WHERE c.wish_id = w.id AND c.user_id = $3
            ) AS purchased_by_me,
            w.created_at
       FROM wish_list w
      WHERE w.participant_id = $1 AND w.config_id = $2
      ORDER BY w.priority DESC, w.created_at ASC, w.id ASC`,
    [participantId, configId, me.id],
  );

  return ok({
    items: rows.map((row) => presentWish(row, me.participant_id)),
    config_id: configId,
    participants,
  });
});

export const POST = route(async (req) => {
  const me = await requireUser();
  if (!me.participant_id) {
    throw new HttpError(400, 'Sua conta ainda não está na lista da família.');
  }
  const configId = await resolveWishlistConfigId();
  if (!configId) {
    throw new HttpError(400, 'Ainda não existe um sorteio. Quando alguém organizar, sua lista entra nele.');
  }

  const body = await readJson<Record<string, unknown>>(req);
  const itemName = parseItemName(body.item_name);
  const itemDescription = parseItemDescription(body.item_description);
  const itemUrl = parseItemUrl(body.item_url);
  const priority = body.priority == null || body.priority === '' ? 1 : parsePriority(body.priority);
  const rawMin = 'price_min_cents' in body ? body.price_min_cents : body.preco_min_centavos;
  const rawMax = 'price_max_cents' in body ? body.price_max_cents : body.preco_max_centavos;
  const priceMinCents = parsePriceCents(rawMin, 'o valor mínimo');
  const priceMaxCents = parsePriceCents(rawMax, 'o valor máximo');
  validatePriceRange(priceMinCents, priceMaxCents);
  const rawImage = 'image_url' in body ? body.image_url : body.foto_url;
  const imageUrl = parseImageUrl(rawImage);

  const count = await query<{ n: number }>(
    'SELECT count(*)::int AS n FROM wish_list WHERE participant_id = $1 AND config_id = $2',
    [me.participant_id, configId],
  );
  if ((count.rows[0]?.n ?? 0) >= 30) {
    throw new HttpError(400, 'A lista chegou em 30 desejos. Apague um para incluir outro.');
  }

  const ano = edicaoAtual();
  const { rows } = await query<WishRow>(
    `INSERT INTO wish_list (
       ano, participant_id, config_id, item_name, item_description, item_url,
       priority, price_min_cents, price_max_cents, image_url
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${WISH_RETURNING}`,
    [
      ano,
      me.participant_id,
      configId,
      itemName,
      itemDescription,
      itemUrl,
      priority,
      priceMinCents,
      priceMaxCents,
      imageUrl,
    ],
  );

  await notificarListaAlterada(me.participant_id, configId);

  return ok(presentWish(rows[0], me.participant_id), 201);
});
