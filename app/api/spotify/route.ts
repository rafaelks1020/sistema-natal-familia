import { ok, requireUser, route } from '@/app/lib/api';
import { playlistData } from './_service';

export const GET = route(async () => ok(await playlistData(await requireUser())));
