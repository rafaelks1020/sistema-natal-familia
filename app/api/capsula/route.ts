import { HttpError, ok, readJson, requireUser, route, toInt } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { carregarCapsula, exigirParente, fotoOpcional, proximaAbertura, textoCapsula } from './_data';

function paraQuem(value: unknown): number | null {
  if (value == null || value === '' || value === 0) return null;
  return toInt(value, 'para quem');
}

export const GET = route(async () => {
  const me = await requireUser();
  return ok(await carregarCapsula(me));
});

export const POST = route(async (req) => {
  const me = await requireUser();
  const body = await readJson<Record<string, unknown>>(req);
  const texto = textoCapsula(body.texto);
  const foto = fotoOpcional(body.image_url);
  const destino = paraQuem(body.para_user_id);
  await exigirParente(destino);
  const ano = edicaoAtual();
  const abre = await proximaAbertura(ano);
  const { rows } = await query<{ id: number }>(
    `INSERT INTO time_capsules (ano, user_id, para_user_id, texto, texto_lacrado, image_url, abre_em)
     VALUES ($1, $2, $3, '', $4, $5, $6) RETURNING id`,
    [ano, me.id, destino, texto, foto, abre.toISOString()],
  );
  const id = rows[0]?.id;
  if (!id) throw new HttpError(500, 'Não deu para guardar a mensagem.');
  return ok({ id }, 201);
});
