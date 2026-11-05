import { ok, requireUser, route } from '@/app/lib/api';
import { getTimeline } from '../data';
export const GET = route(async () => ok({ editions: await getTimeline(await requireUser()) }));
