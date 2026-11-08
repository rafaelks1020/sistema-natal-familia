import { ok, readJson, requireAdmin, route, toInt } from '@/app/lib/api';
import {
  criarAjusteGamificacao,
  removerAjusteGamificacao,
} from '@/app/lib/gamificacao/painel';

export const POST = route(async (req) => {
  const me = await requireAdmin();
  const body = await readJson<Record<string, unknown>>(req);
  return ok(await criarAjusteGamificacao(me, body), 201);
});

export const DELETE = route(async (req) => {
  const me = await requireAdmin();
  const url = new URL(req.url);
  const idQuery = url.searchParams.get('id');
  const id = idQuery ? toInt(idQuery, 'id') : toInt((await readJson<Record<string, unknown>>(req)).id, 'id');
  return ok(await removerAjusteGamificacao(me, id));
});
