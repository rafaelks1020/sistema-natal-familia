import { query } from '@/app/lib/db';
import { isBlobUrl, ok, requireUser, route } from '@/app/lib/api';

// GET /api/cartao/fotos -> { avatar, fotos: string[] }
// Fotos da própria pessoa para montar o cartão: perfil, álbum e publicações dela (até 36).

export const GET = route(async () => {
  const me = await requireUser();
  const { rows } = await query<{ url: string }>(
    `SELECT url FROM (
       SELECT image_url AS url, created_at FROM album_photos WHERE user_id = $1
       UNION ALL
       SELECT image_url AS url, created_at FROM family_posts WHERE user_id = $1 AND image_url IS NOT NULL
     ) t
     ORDER BY created_at DESC
     LIMIT 60`,
    [me.id],
  );
  const vistas = new Set<string>();
  const fotos: string[] = [];
  for (const r of rows) {
    const url = String(r.url ?? '').trim();
    if (!url || vistas.has(url) || !isBlobUrl(url)) continue;
    vistas.add(url);
    fotos.push(url);
    if (fotos.length >= 36) break;
  }
  return ok({ avatar: me.avatar_url, fotos });
});
