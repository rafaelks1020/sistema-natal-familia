import { ok, requireUser, route, toInt } from '@/app/lib/api';
import { montarPerfilPontos } from '@/app/lib/gamificacao/painel';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ userId: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const me = await requireUser();
  const { userId } = await params;
  const alvoId = toInt(userId, 'pessoa');
  const res = ok(await montarPerfilPontos(me.id, alvoId));
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
});
