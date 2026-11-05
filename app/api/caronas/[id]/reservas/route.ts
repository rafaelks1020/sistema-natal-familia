import { HttpError, ok, readJson, requireUser, route, toInt } from '@/app/lib/api';
import { transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { enviarPush } from '@/app/lib/push';
import type { Oferta } from '../../_types';
type Context = { params: Promise<{ id: string }> };

export const POST = route<Context>(async (req, ctx) => {
  const me = await requireUser();
  const id = toInt((await ctx.params).id);
  const body = await readJson<{ quantidade?: unknown } | null>(req);
  const quantidade = toInt(body?.quantidade, 'quantidade');
  if (quantidade > 100) throw new HttpError(400, 'Informe até 100 vagas.');
  const owner = await transaction(async (q) => {
    const { rows: [oferta] } = await q<Oferta>('SELECT * FROM ride_offers WHERE id = $1 AND ano = $2 FOR UPDATE', [id, edicaoAtual()]);
    if (!oferta || !oferta.ativo) throw new HttpError(404, 'Oferta indisponível.');
    if (!oferta.tipo.endsWith('_oferta') || oferta.user_id === me.id) throw new HttpError(400, 'Escolha uma oferta de outra pessoa.');
    const blocked = await q(`SELECT 1 FROM user_blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`, [me.id, oferta.user_id]);
    if (blocked.rowCount) throw new HttpError(403, 'Oferta indisponível.');
    const existing = await q('SELECT 1 FROM ride_reservations WHERE oferta_id = $1 AND user_id = $2', [id, me.id]);
    if (existing.rowCount) throw new HttpError(409, 'Você já tem uma reserva nessa oferta.');
    if (oferta.vagas < quantidade) throw new HttpError(409, 'Não há vagas suficientes. Atualize a lista.');
    await q('INSERT INTO ride_reservations (ano, oferta_id, user_id, quantidade) VALUES ($1,$2,$3,$4)', [oferta.ano, id, me.id, quantidade]);
    await q('UPDATE ride_offers SET vagas = vagas - $1 WHERE id = $2', [quantidade, id]);
    return oferta.user_id;
  });
  void enviarPush([owner], { titulo: 'Nova reserva', corpo: `${me.name} reservou ${quantidade} vaga(s).`, rota: '/caronas' });
  return ok({ ok: true }, 201);
});
export const DELETE = route<Context>(async (req, ctx) => {
  const me = await requireUser();
  const id = toInt((await ctx.params).id);
  const body = await readJson<{ reserva_user_id?: unknown } | null>(req);
  const pessoa = body?.reserva_user_id == null ? me.id : toInt(body.reserva_user_id);
  await transaction(async (q) => {
    const { rows: [oferta] } = await q<Oferta>('SELECT * FROM ride_offers WHERE id = $1 AND ano = $2 FOR UPDATE', [id, edicaoAtual()]);
    if (!oferta) throw new HttpError(404, 'Oferta não encontrada.');
    if (pessoa !== me.id && oferta.user_id !== me.id && !me.is_admin) throw new HttpError(403, 'Só quem oferece pode remover outra pessoa.');
    const { rows: [reserva] } = await q<{ quantidade: number }>('DELETE FROM ride_reservations WHERE oferta_id = $1 AND user_id = $2 RETURNING quantidade', [id, pessoa]);
    if (!reserva) throw new HttpError(404, 'Reserva não encontrada.');
    await q('UPDATE ride_offers SET vagas = vagas + $1 WHERE id = $2', [reserva.quantidade, id]);
  });
  return ok({ ok: true });
});
