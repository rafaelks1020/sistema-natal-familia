import { ok, requireUser, route } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { getAttendance, getSettings } from '@/app/(app)/_inicio/server';
import type { HomeData } from '@/app/(app)/_inicio/types';

function firstImage(images: string | null, single: string | null): string | null {
  try {
    const parsed: unknown = images ? JSON.parse(images) : [];
    if (Array.isArray(parsed)) {
      const first = parsed.find((url: unknown) => typeof url === 'string' && url.startsWith('https://'));
      if (first) return first;
    }
  } catch { /* Fotos antigas podem conter JSON inválido. */ }
  return single?.startsWith('https://') ? single : null;
}

export const GET = route(async () => {
  const me = await requireUser();
  const [settings, attendance, totals, posts, santa] = await Promise.all([
    getSettings(),
    getAttendance(me.participant_id),
    query<{ pagos: number; total: number; gasto: string }>(
      `SELECT COUNT(*) FILTER (WHERE paid)::int AS pagos, COUNT(*)::int AS total,
        (SELECT COALESCE(SUM(value), 0) FROM purchases) AS gasto FROM participants`,
    ),
    query<Omit<HomeData['recentPosts'][number], 'first_image'> & { image_url: string | null; image_urls: string | null }>(
      `SELECT p.id, u.name AS user_name, u.avatar_url, p.content, p.image_url, p.image_urls, p.created_at
         FROM family_posts p JOIN family_users u ON u.id = p.user_id
        ORDER BY p.created_at DESC NULLS LAST, p.id DESC LIMIT 3`,
    ),
    query<{ revealed: boolean }>(
      `SELECT COALESCE((SELECT d.revealed FROM secret_santa_draws d
         WHERE d.config_id = c.id AND d.giver_id = $1 ORDER BY d.id DESC LIMIT 1), false) AS revealed
         FROM secret_santa_config c WHERE c.is_active = true ORDER BY c.id DESC LIMIT 1`,
      [me.participant_id],
    ),
  ]);
  const { pagos, total } = totals.rows[0];
  const gasto = Number(totals.rows[0].gasto);
  const arrecadado = Math.round(pagos * settings.contribution_value * 100) / 100;
  return ok({
    settings, attendance,
    vaquinha: { arrecadado, gasto, saldo: Math.round((arrecadado - gasto) * 100) / 100, pagos, total },
    recentPosts: posts.rows.map(({ image_urls, image_url, ...post }) => ({ ...post, first_image: firstImage(image_urls, image_url) })),
    secretSanta: { active: santa.rows.length > 0, revealed: santa.rows[0]?.revealed ?? false },
  });
});
