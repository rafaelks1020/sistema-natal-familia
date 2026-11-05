import { ok, requireAdmin, route } from '@/app/lib/api';
import { listar, recursoDisponivel } from '@/app/lib/admin/consulta';

type Context = { params: Promise<{ recurso: string }> };

// GET /api/admin/r/<recurso>?q=&cursor= -> 20 itens por página, mais recente primeiro.
export const GET = route<Context>(async (req, { params }) => {
  await requireAdmin();
  const r = await recursoDisponivel((await params).recurso);
  const url = new URL(req.url);
  const resposta = ok(await listar(r, url.searchParams.get('q') ?? '', url.searchParams.get('cursor') ?? ''));
  resposta.headers.set('Cache-Control', 'no-store');
  return resposta;
});
