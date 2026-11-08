import { ok, requireUser, route } from '@/app/lib/api';
import { montarPainelMissoes } from '@/app/lib/gamificacao/painel';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const me = await requireUser();
  const res = ok(await montarPainelMissoes(me));
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
});
