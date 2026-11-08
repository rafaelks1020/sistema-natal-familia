import { ok, readJson, requireAdmin, route, toInt } from '@/app/lib/api';
import {
  atualizarConfigGamificacao,
  montarPainelAdminGamificacao,
  montarPainelPontos,
} from '@/app/lib/gamificacao/painel';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const me = await requireAdmin();
  const url = new URL(req.url);
  const userParam = url.searchParams.get('user') ?? url.searchParams.get('user_id');
  if (userParam !== null && userParam !== '') {
    const alvoId = toInt(userParam, 'pessoa');
    const resUser = ok(await montarPainelPontos(alvoId, { visaoAdmin: true }));
    resUser.headers.set('Cache-Control', 'private, no-store');
    return resUser;
  }
  const res = ok(await montarPainelAdminGamificacao(me));
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
});

export const PATCH = route(async (req) => {
  const me = await requireAdmin();
  const body = await readJson<Record<string, unknown>>(req);
  return ok(await atualizarConfigGamificacao(me, body));
});

export const PUT = PATCH;
