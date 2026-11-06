import { HttpError, ok, requireUser, route } from '@/app/lib/api';
import { edicaoAtual } from '@/app/lib/edicao';
import { retrospectiva } from '../_service';

export const GET = route(async req => {
  const me = await requireUser();
  const raw = new URL(req.url).searchParams.get('ano');
  const ano = raw ? Number(raw) : edicaoAtual();
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) throw new HttpError(400, 'Escolha um ano válido.');
  return ok(await retrospectiva(me, ano));
});
