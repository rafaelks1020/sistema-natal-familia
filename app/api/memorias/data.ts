import 'server-only';
import { HttpError } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { edicaoAtual, hojeSP } from '@/app/lib/edicao';
import type { SessionUser } from '@/app/lib/session';
import { albumYear, decoratePhotos, getAlbum, PHOTO_CTE } from '../album/data';
import type { AlbumItem } from '../album/types';
import type { MemoryEdition, MemorySlide, Retrospective } from './types';

export function retrospectiveAvailable(user: SessionUser, ano: number): boolean {
  return user.is_admin || hojeSP() >= `${ano}-12-25`;
}

export async function getOnThisDay(user: SessionUser): Promise<AlbumItem[]> {
  const { rows } = await query<Parameters<typeof decoratePhotos>[1][number]>(`${PHOTO_CTE} SELECT * FROM photos
    WHERE ano < $2 AND substring(taken_on, 6, 5) = $3 ORDER BY ano DESC, sort_date DESC, key COLLATE "C" DESC LIMIT 30`,
  [user.id, edicaoAtual(), hojeSP().slice(5)]);
  return decoratePhotos(user, rows);
}

export async function getTimeline(user: SessionUser): Promise<MemoryEdition[]> {
  const [stats, covers, topPosters] = await Promise.all([
    query<{ ano: number; photos: number; comments: number; people: number }>(`${PHOTO_CTE}
      SELECT p.ano, count(*)::int AS photos,
        (SELECT count(*)::int FROM family_post_comments c JOIN family_posts post ON post.id = c.post_id
          WHERE post.ano = p.ano AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE b.blocker_id = $1 AND b.blocked_id IN (post.user_id, c.user_id))) AS comments,
        (SELECT count(DISTINCT person)::int FROM (
          SELECT 'user:' || user_id AS person FROM photos WHERE ano = p.ano AND user_id IS NOT NULL
          UNION SELECT t.person_source || ':' || t.person_id FROM album_tags t JOIN photos tagged ON tagged.key = t.photo_key AND tagged.url = t.image_url
            WHERE tagged.ano = p.ano AND NOT EXISTS(SELECT 1 FROM user_blocks b
              WHERE t.person_source = 'user' AND b.blocker_id = $1 AND b.blocked_id = t.person_id)
        ) people) AS people
      FROM photos p WHERE p.ano <= $2 GROUP BY p.ano ORDER BY p.ano DESC`, [user.id, edicaoAtual()]),
    query<{ exists: boolean }>("SELECT to_regclass('public.family_official_photos') IS NOT NULL AS exists"),
    query<{ ano: number; name: string; count: number }>(`SELECT DISTINCT ON(p.ano) p.ano, u.name, count(*)::int AS count
      FROM family_posts p JOIN family_users u ON u.id = p.user_id
      WHERE p.ano <= $2 AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE b.blocker_id = $1 AND b.blocked_id = p.user_id)
      GROUP BY p.ano, u.id, u.name ORDER BY p.ano, count(*) DESC, u.id`, [user.id, edicaoAtual()]),
  ]);
  const official = covers.rows[0].exists ? await query<{ ano: number; image_url: string }>(`SELECT ano, image_url FROM family_official_photos p
    WHERE ano <= $2 AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE b.blocker_id = $1 AND b.blocked_id = p.user_id)`, [user.id, edicaoAtual()]) : { rows: [] };
  const highlights = await query<Parameters<typeof decoratePhotos>[1][number]>(`${PHOTO_CTE} SELECT * FROM (
    SELECT p.*, row_number() OVER(PARTITION BY ano ORDER BY likes DESC, comments DESC, sort_date DESC, key COLLATE "C" DESC) AS rank
    FROM photos p) ranked WHERE rank <= 3 ORDER BY ano DESC, rank`, [user.id]);
  const photos = await decoratePhotos(user, highlights.rows);
  const years = new Set(stats.rows.map(e => e.ano));
  for (const row of [...official.rows, ...topPosters.rows]) if (!years.has(row.ano)) {
    stats.rows.push({ ano: row.ano, photos: 0, comments: 0, people: 0 }); years.add(row.ano);
  }
  return stats.rows.sort((a, b) => b.ano - a.ano).map(row => ({ ...row, available: retrospectiveAvailable(user, row.ano),
    cover: official.rows.find(p => p.ano === row.ano)?.image_url ?? photos.find(p => p.ano === row.ano)?.url ?? null,
    highlights: photos.filter(p => p.ano === row.ano),
    topPoster: topPosters.rows.find(p => p.ano === row.ano) ?? null,
  }));
}

export async function getRetrospective(user: SessionUser, year: unknown): Promise<Retrospective> {
  const ano = albumYear(year);
  if (!retrospectiveAvailable(user, ano)) throw new HttpError(403, `A retrospectiva de ${ano} estará disponível em 25/12/${ano}.`);
  const [timeline, album] = await Promise.all([getTimeline(user), getAlbum(user, { ano, all: true })]);
  const edition = timeline.find(e => e.ano === ano) ?? { ano, cover: null, photos: 0, comments: 0, people: 0, highlights: [], available: true, topPoster: null };
  const slides: MemorySlide[] = [
    { title: `Nosso Natal de ${ano}`, text: 'Vamos reviver o que guardamos juntos.', url: edition.cover ?? undefined },
    { title: 'Um ano para guardar', text: `${edition.photos} fotos, ${edition.comments} comentários e ${edition.people} pessoas nas memórias.` },
  ];
  const favorite = edition.highlights[0];
  if (favorite) slides.push({ title: 'A foto mais curtida', text: `${favorite.likes} curtidas. ${favorite.author_name}`, photo: favorite });
  if (edition.topPoster) slides.push({ title: 'Quem mais compartilhou', text: `${edition.topPoster.name} publicou ${edition.topPoster.count} vezes no mural.` });
  const commented = album.items.filter(p => p.comments > 0).sort((a, b) => b.comments - a.comments);
  const seenPosts = new Set<number>();
  for (const photo of commented) {
    if (!photo.post_id || seenPosts.has(photo.post_id)) continue;
    seenPosts.add(photo.post_id);
    slides.push({ title: 'Uma boa conversa', text: `${photo.comments} comentários. ${photo.caption}`, photo });
    if (seenPosts.size === 3) break;
  }
  for (const photo of album.items.slice().reverse().slice(0, 30)) slides.push({ title: `Natal de ${ano}`, text: photo.caption || `Foto de ${photo.author_name}`, photo });
  slides.push({ title: 'Até o próximo Natal', text: 'O melhor presente é continuar juntos.' });
  return { edition, slides };
}
