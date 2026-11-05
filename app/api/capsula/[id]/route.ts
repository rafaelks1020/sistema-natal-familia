import { HttpError, ok, readJson, requireUser, route, toInt } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { hojeSP } from '@/app/lib/edicao';
import { exigirParente, fotoOpcional, textoCapsula } from '../_data';

type Ctx = { params: Promise<{ id: string }> };

function paraQuem(value: unknown): number | null {
  if (value == null || value === '' || value === 0) return null;
  return toInt(value, 'para quem');
}

export const PATCH = route<Ctx>(async (req, ctx) => {
  const me = await requireUser();
  const id = toInt((await ctx.params).id);
  const body = await readJson<Record<string, unknown>>(req);
  const texto = textoCapsula(body.texto);
  const destino = paraQuem(body.para_user_id);
  await exigirParente(destino);
  const atual = await query<{ image_url: string | null }>(
    `SELECT image_url FROM time_capsules
     WHERE id = $1 AND user_id = $2 AND abre_em > NOW() AND $3::date <= make_date(ano, 12, 31)`,
    [id, me.id, hojeSP()],
  );
  if (!atual.rows[0]) throw new HttpError(404, 'Essa mensagem não pode mais ser mudada.');
  const foto = Object.prototype.hasOwnProperty.call(body, 'image_url')
    ? fotoOpcional(body.image_url)
    : atual.rows[0].image_url;
  const result = await query(
    `UPDATE time_capsules
     SET texto_lacrado = $1, image_url = $2, para_user_id = $3
     WHERE id = $4 AND user_id = $5 AND abre_em > NOW() AND $6::date <= make_date(ano, 12, 31)
     RETURNING id`,
    [texto, foto, destino, id, me.id, hojeSP()],
  );
  if (!result.rowCount) throw new HttpError(404, 'Essa mensagem não pode mais ser mudada.');
  return ok({ id });
});

export const DELETE = route<Ctx>(async (_req, ctx) => {
  const me = await requireUser();
  const id = toInt((await ctx.params).id);
  const result = await query(
    `DELETE FROM time_capsules
     WHERE id = $1 AND (
       $2::boolean
       OR (user_id = $3 AND abre_em > NOW() AND $4::date <= make_date(ano, 12, 31))
     )
     RETURNING id`,
    [id, me.is_admin, me.id, hojeSP()],
  );
  if (!result.rowCount) throw new HttpError(404, 'Não dá para apagar esta mensagem.');
  return ok({ ok: true });
});
