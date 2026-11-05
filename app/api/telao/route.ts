import { route, requireUser, ok } from '@/app/lib/api';
import { getScreen } from './data';
export const GET = route(async () => ok(await getScreen(await requireUser())));
