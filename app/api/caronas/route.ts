import { cleanText, HttpError, ok, readJson, requireUser, route, toInt } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { getCaronas } from './_data';
import { tiposCarona, type TipoCarona } from './_types';

export const GET = route(async () => {
  const me = await requireUser();
  return ok(await getCaronas(me.id));
});
export const POST = route(async (req) => {
  const me = await requireUser();
  const body = await readJson<Record<string, unknown> | null>(req);
  if (!body || !tiposCarona.includes(body.tipo as TipoCarona)) throw new HttpError(400, 'Escolha o tipo de anúncio.');
  const vagas = toInt(body.vagas, 'vagas');
  if (vagas > 100) throw new HttpError(400, 'Informe até 100 vagas.');
  const origem = cleanText(body.origem, 'a cidade ou saída', 160);
  const quando = cleanText(body.quando, 'quando', 160);
  const observacao = cleanText(body.observacao, 'a observação', 2000, false);
  const telefone = cleanText(body.telefone, 'o telefone', 40, false) || null;
  const { rows } = await query(`INSERT INTO ride_offers (ano, user_id, tipo, origem, quando, vagas, observacao, telefone)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [edicaoAtual(), me.id, body.tipo, origem, quando, vagas, observacao, telefone]);
  return ok(rows[0], 201);
});
