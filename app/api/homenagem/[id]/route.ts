import { HttpError, ok, readJson, requireUser, route, toInt } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { apagarMemorial, editarMemorial, fotoOpcional, lerMemorial } from '../_data';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, ctx) => {
  const me = await requireUser();
  const id = toInt((await ctx.params).id);
  const body = await readJson<Record<string, unknown>>(req);
  const atual = await query<{ foto_url: string | null }>(
    'SELECT foto_url FROM family_memorials WHERE id = $1',
    [id],
  );
  if (!atual.rows[0]) throw new HttpError(404, 'Homenagem não encontrada.');
  const foto = Object.prototype.hasOwnProperty.call(body, 'foto_url') ? fotoOpcional(body.foto_url) : atual.rows[0].foto_url;
  await editarMemorial(me, id, lerMemorial(body, foto));
  return ok({ id });
});

export const DELETE = route<Ctx>(async (_req, ctx) => {
  const me = await requireUser();
  await apagarMemorial(me, toInt((await ctx.params).id));
  return ok({ ok: true });
});
