import { cleanText, HttpError, isBlobUrl, ok, readJson, requireUser, route, toInt } from '@/app/lib/api';
import { query, transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { getContas, lerContas, travarContas } from './_data';

export const GET = route(async () => {
  const me = await requireUser();
  return ok(await getContas(me.id, me.is_admin));
});
export const PATCH = route(async (req) => {
  const me = await requireUser();
  const body = await readJson<Record<string, unknown> | null>(req);
  if (!body || typeof body.pix_key !== 'string') throw new HttpError(400, 'Informe sua chave Pix ou deixe em branco.');
  const chave = cleanText(body.pix_key, 'a chave Pix', 200, false);
  await query('UPDATE family_users SET pix_key = $1 WHERE id = $2', [chave || null, me.id]);
  return ok({ ok: true });
});
export const POST = route(async (req) => {
  const me = await requireUser();
  const body = await readJson<Record<string, unknown> | null>(req);
  if (!body) throw new HttpError(400, 'Dados inválidos.');
  const descricao = cleanText(body.descricao, 'a descrição', 240);
  const valor = toInt(body.valor_centavos, 'valor em centavos');
  if (valor > 100000000) throw new HttpError(400, 'O valor máximo por despesa é R$ 1.000.000,00.');
  const comprovante = body.comprovante_url || null;
  if (comprovante !== null && !isBlobUrl(comprovante)) throw new HttpError(400, 'Envie o comprovante pelo botão de foto.');
  if (body.partes !== undefined && (!Array.isArray(body.partes) || body.partes.length > 500)) throw new HttpError(400, 'Escolha até 500 pessoas para dividir.');
  const escolhidos = Array.isArray(body.partes) ? [...new Set(body.partes.map(id => toInt(id, 'pessoa')))] : null;
  const ano = edicaoAtual();
  const despesa = await transaction(async q => {
    await travarContas(q, ano);
    const { rows: pessoas } = escolhidos
      ? await q<{ id: number }>('SELECT id FROM family_users WHERE id = ANY($1::int[]) ORDER BY id FOR KEY SHARE', [escolhidos])
      : await q<{ id: number }>(`SELECT u.id FROM family_users u WHERE EXISTS (
        SELECT 1 FROM family_attendance a JOIN participants p ON p.id = a.participant_id
        WHERE (p.user_id = u.id OR a.user_id = u.id) AND a.status = 'yes') ORDER BY u.id FOR KEY SHARE`);
    if (!pessoas.length) throw new HttpError(400, 'Escolha pelo menos uma pessoa para dividir.');
    if (escolhidos && pessoas.length !== escolhidos.length) throw new HttpError(400, 'Uma pessoa escolhida não está mais na família. Atualize a página.');
    const { rows: [nova] } = await q<{ id: number }>(`INSERT INTO ceia_despesas (ano, user_id, descricao, valor_centavos, comprovante_url)
      VALUES ($1,$2,$3,$4,$5) RETURNING id`, [ano, me.id, descricao, valor, comprovante]);
    await q(`INSERT INTO ceia_despesa_partes (ano, despesa_id, user_id) SELECT $1, $2, unnest($3::int[])`, [ano, nova.id, pessoas.map(p => p.id)]);
    return nova;
  });
  return ok(despesa, 201);
});

export const PUT = route(async (req) => {
  const me = await requireUser();
  const body = await readJson<Record<string, unknown> | null>(req);
  const de = toInt(body?.de_user_id, 'quem pagou');
  const valor = toInt(body?.valor_centavos, 'valor');
  const ano = edicaoAtual();
  await transaction(async q => {
    await travarContas(q, ano);
    const contas = await lerContas(q, me.id, ano);
    const transferencia = contas.transferencias.find(t => t.de_user_id === de && t.para_user_id === me.id);
    if (!transferencia || transferencia.valor_centavos !== valor) throw new HttpError(409, 'Os saldos mudaram. Atualize antes de confirmar.');
    // O recebedor é sempre a sessão. O corpo só identifica quem lhe pagou.
    await q(`INSERT INTO ceia_acertos (ano, de_user_id, para_user_id, valor_centavos, confirmado_em)
      VALUES ($1,$2,$3,$4,NOW())`, [ano, de, me.id, valor]);
  });
  return ok({ ok: true });
});
