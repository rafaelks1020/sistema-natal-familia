import { ok, requireAdmin, route } from '@/app/lib/api';
import { listarLog } from '@/app/lib/admin/consulta';

export const GET = route(async (req) => {
  await requireAdmin();
  const resposta = ok(await listarLog(new URL(req.url).searchParams.get('cursor') ?? ''));
  resposta.headers.set('Cache-Control', 'no-store');
  return resposta;
});
