import { ok, requireUser, route } from '@/app/lib/api';
import { getOnThisDay } from '../data';
export const GET = route(async () => ok({ items: await getOnThisDay(await requireUser()) }));
