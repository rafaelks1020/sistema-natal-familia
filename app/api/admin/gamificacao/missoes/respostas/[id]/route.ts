import { ok, readJson, requireAdmin, route, toInt } from '@/app/lib/api';
import { avaliarRespostaMissao } from '@/app/lib/gamificacao/painel';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const me = await requireAdmin();
  const { id } = await params;
  const respostaId = toInt(id, 'resposta');
  const body = await readJson<Record<string, unknown>>(req);
  return ok(await avaliarRespostaMissao(me, respostaId, body));
});

export const POST = PATCH;
