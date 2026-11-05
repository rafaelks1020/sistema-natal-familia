import { HttpError, ok, readJson, requireUser, route, toInt } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import {
  parseItemDescription,
  parseItemName,
  parseItemUrl,
  parsePriority,
  presentWish,
  resolveWishlistConfigId,
  WISH_RETURNING,
  WishRow,
} from './shared';

// GET  /api/wishlist?participant_id=N   (sem param = a minha)
//      { items, config_id }
//      config ativo; se não houver, o último config criado; se não houver nenhum, items [].
//      O dono não recebe o campo purchased.
// POST /api/wishlist  { item_name, item_description?, item_url?, priority }
//      grava em me.participant_id.

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
    const found = await query('SELECT 1 FROM participants WHERE id = $1', [participantId]);
    if (!found.rows.length) throw new HttpError(404, 'Pessoa não encontrada.');
  }

  const configId = await resolveWishlistConfigId();
  if (!participantId || !configId) {
    return ok({ items: [], config_id: configId });
  }

  const { rows } = await query<WishRow>(
    `SELECT ${WISH_RETURNING}
       FROM wish_list
      WHERE participant_id = $1 AND config_id = $2
      ORDER BY priority DESC, created_at ASC, id ASC`,
    [participantId, configId],
  );

  return ok({
    items: rows.map((row) => presentWish(row, me.participant_id)),
    config_id: configId,
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

  const count = await query<{ n: number }>(
    'SELECT count(*)::int AS n FROM wish_list WHERE participant_id = $1 AND config_id = $2',
    [me.participant_id, configId],
  );
  if ((count.rows[0]?.n ?? 0) >= 30) {
    throw new HttpError(400, 'A lista chegou em 30 desejos. Apague um para incluir outro.');
  }

  const { rows } = await query<WishRow>(
    `INSERT INTO wish_list (participant_id, config_id, item_name, item_description, item_url, priority)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${WISH_RETURNING}`,
    [me.participant_id, configId, itemName, itemDescription, itemUrl, priority],
  );

  return ok(presentWish(rows[0], me.participant_id), 201);
});
