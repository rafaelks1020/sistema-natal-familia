import { ok, requireAdmin, route } from '@/app/lib/api';
import { montarFicha } from '@/app/lib/lembretes';

// Ficha para o organizador: quem ainda não confirmou presença e quem não tem pagamento na vaquinha.
export const GET = route(async () => {
  await requireAdmin();
  return ok(await montarFicha());
});
