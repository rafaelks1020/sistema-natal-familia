import { requireUser } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { loadHistory, loadHints, loadSanta, loadTheme } from '@/app/api/secret-santa/features';
import { presentWish, resolveWishlistConfigId, WISH_RETURNING, type WishRow } from '@/app/api/wishlist/shared';
import Client from './_client';
export const dynamic = 'force-dynamic';
export default async function AmigoOcultoPage() {
  const me = await requireUser();
  const [santa, theme, hints, history, configId] = await Promise.all([loadSanta(me), loadTheme(), loadHints(me), loadHistory(), resolveWishlistConfigId()]);
  const wishes = me.participant_id && configId ? await query<WishRow>(
    `SELECT ${WISH_RETURNING} FROM wish_list WHERE participant_id = $1 AND config_id = $2 ORDER BY priority DESC, created_at ASC, id ASC`, [me.participant_id, configId]) : { rows: [] };
  return <Client initialSanta={santa} initialWishes={{ items: wishes.rows.map(row => presentWish(row, me.participant_id)), config_id: configId }} initialTheme={theme} initialHints={JSON.parse(JSON.stringify(hints))} initialHistory={history} />;
}
