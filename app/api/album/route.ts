import { ok, requireUser, route } from '@/app/lib/api';
import { getAlbum } from './data';

export type { AlbumItem } from './data';

export const GET = route(async (req) => {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  return ok(await getAlbum(user, {
    limit: Number(searchParams.get('limit') || 40),
    cursor: searchParams.get('cursor'),
  }));
});
