import { ok, requireUser, route } from '@/app/lib/api';
import { edicaoAtual } from '@/app/lib/edicao';
import { getOnThisDay, getTimeline } from './data';
export const GET = route(async () => {
  const me = await requireUser(); const [today, editions] = await Promise.all([getOnThisDay(me), getTimeline(me)]);
  return ok({ today, editions, currentYear: edicaoAtual() });
});
