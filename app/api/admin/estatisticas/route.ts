import { ok, requireAdmin, route } from '@/app/lib/api';
import { carregarEstatisticas } from '@/app/lib/admin/estatisticas';

export const GET = route(async () => {
  await requireAdmin();
  const resposta = ok(await carregarEstatisticas());
  resposta.headers.set('Cache-Control', 'no-store');
  return resposta;
});
