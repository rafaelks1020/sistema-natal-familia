import { ok, requireAdmin, route } from '@/app/lib/api';
import { revelarResultadoGamificacao } from '@/app/lib/gamificacao/painel';

export const POST = route(async (req) => {
  const me = await requireAdmin();
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  return ok(await revelarResultadoGamificacao(me, body));
});
