import 'server-only';
import type { SessionUser } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { getAttendance, getSettings } from '@/app/(app)/_inicio/server';
import type { HomeData } from '@/app/(app)/_inicio/types';
import { fetchArrecadado } from '@/app/api/vaquinha/arrecadado';

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

export async function getHome(me: SessionUser): Promise<HomeData> {
  const [settingsPack, attendance, totals, posts, santa] = await Promise.all([
    getSettings().then(async (settings) => ({
      settings,
      arrecadado: await fetchArrecadado(settings.contribution_value),
    })),
    getAttendance(me.participant_id),
    query<{ pagos: number; total: number; gasto: string }>(
      `SELECT COUNT(*) FILTER (WHERE paid)::int AS pagos, COUNT(*)::int AS total,
        (SELECT COALESCE(SUM(value), 0) FROM purchases WHERE ano = $1) AS gasto FROM participants`,
      [edicaoAtual()],
    ),
    query<Omit<HomeData['recentPosts'][number], 'first_image' | 'created_at'> & { created_at: Date | string } & { image_url: string | null; image_urls: string | null }>(
      `SELECT p.id, u.name AS user_name, u.avatar_url, p.content, p.image_url, p.image_urls, p.created_at
         FROM family_posts p JOIN family_users u ON u.id = p.user_id
        WHERE NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $1 AND b.blocked_id = p.user_id)
        ORDER BY p.created_at DESC NULLS LAST, p.id DESC LIMIT 3`,
      [me.id],
    ),
    query<{ revealed: boolean }>(
      `SELECT d.revealed
         FROM secret_santa_draws d
        WHERE d.giver_id = $1
          AND d.config_id = (
            SELECT c.id FROM secret_santa_config c
             WHERE c.is_active IS TRUE
             ORDER BY c.id DESC
             LIMIT 1
          )
        ORDER BY d.id DESC
        LIMIT 1`,
      [me.participant_id],
    ),
  ]);
  const { settings, arrecadado } = settingsPack;
  const { pagos, total } = totals.rows[0];
  const gasto = Number(totals.rows[0].gasto);
  return {
    settings, attendance,
    vaquinha: { arrecadado, gasto, saldo: Math.round((arrecadado - gasto) * 100) / 100, pagos, total },
    recentPosts: posts.rows.map(({ image_urls, image_url, ...post }) => ({ ...post, created_at: post.created_at instanceof Date ? post.created_at.toISOString() : post.created_at, first_image: firstImage(image_urls, image_url) })),
    secretSanta: { active: santa.rows.length > 0, revealed: Boolean(santa.rows[0]?.revealed) },
  };
}
