import { ok, requireUser, route } from '@/app/lib/api';
import { montarRevelacaoTelao } from '@/app/lib/gamificacao/painel';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const me = await requireUser();
  const res = ok(await montarRevelacaoTelao(me));
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
});
