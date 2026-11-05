import { HttpError, ok, readJson, requireAdmin, route, toInt } from '@/app/lib/api';
import { transaction } from '@/app/lib/db';
import { novoToken } from '@/app/lib/convites';
import { edicaoAtual } from '@/app/lib/edicao';
import { enviarPush } from '@/app/lib/push';

type Contexto = { params: Promise<{ id: string }> };

export const PATCH = route<Contexto>(async (req, ctx) => {
  const me = await requireAdmin();
  const id = toInt((await ctx.params).id);
  const body = await readJson<Record<string, unknown>>(req);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Dados inválidos.');
  if (body.status !== 'aprovado' && body.status !== 'recusado') throw new HttpError(400, 'Escolha aprovar ou recusar.');
  const status = body.status;
  const resultado = await transaction(async (q) => {
    const { rows } = await q<{ id: number; user_id: number; nome: string; status: string }>(
      'SELECT id, user_id, nome, status FROM invitation_requests WHERE id = $1 AND ano = $2 FOR UPDATE', [id, edicaoAtual()],
    );
    const pedido = rows[0];
    if (!pedido) throw new HttpError(404, 'Pedido não encontrado.');
    if (pedido.status === status) return { user_id: pedido.user_id, mudou: false };
    if (pedido.status !== 'pendente') throw new HttpError(409, 'Esse pedido já foi analisado.');
    let conviteId: number | null = null;
    if (status === 'aprovado') {
      const convite = await q<{ id: number }>(
        `INSERT INTO invites(token, label, max_uses, expires_at, created_by)
         VALUES ($1, $2, 1, NOW() + INTERVAL '30 days', $3) RETURNING id`, [novoToken(), pedido.nome, me.id],
      );
      conviteId = convite.rows[0].id;
    }
    await q('UPDATE invitation_requests SET status = $2, invite_id = $3, reviewed_by = $4, reviewed_at = NOW() WHERE id = $1', [id, status, conviteId, me.id]);
    return { user_id: pedido.user_id, mudou: true };
  });
  if (resultado.mudou) void enviarPush([resultado.user_id], {
    titulo: status === 'aprovado' ? 'Seu convite foi aprovado!' : 'Seu pedido de convite foi analisado',
    corpo: status === 'aprovado' ? 'O link já está disponível para compartilhar com seu parente.' : 'O convite não foi aprovado. Converse com quem organiza.', rota: '/convidar',
  });
  return ok({ ok: true });
});

export const DELETE = route<Contexto>(async (_req, ctx) => {
  await requireAdmin();
  const id = toInt((await ctx.params).id);
  await transaction(async (q) => {
    const { rows } = await q<{ invite_id: number | null }>('SELECT invite_id FROM invitation_requests WHERE id = $1 AND ano = $2 FOR UPDATE', [id, edicaoAtual()]);
    if (!rows.length) throw new HttpError(404, 'Pedido não encontrado.');
    if (rows[0].invite_id) await q('UPDATE invites SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL', [rows[0].invite_id]);
    await q('DELETE FROM invitation_requests WHERE id = $1', [id]);
  });
  return ok({ ok: true });
});
