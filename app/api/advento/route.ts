import { ok, requireUser, route } from '@/app/lib/api';
import { carregarCalendario } from '@/app/lib/advento';

// GET /api/advento: grade do ano. Janela fechada vai sem título, texto, foto e opções.
export const GET = route(async () => {
  const me = await requireUser();
  return ok(await carregarCalendario(me));
});
