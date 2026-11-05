import { cleanText, HttpError, ok, readJson, requireAdmin, requireUser, route } from '@/app/lib/api';
import { query, transaction } from '@/app/lib/db';
import { carregarPedidos } from '@/app/lib/convites';
import { edicaoAtual } from '@/app/lib/edicao';
import { enviarPush } from '@/app/lib/push';

export const GET = route(async (req) => {
  const organizar = new URL(req.url).searchParams.get('organizar') === '1';
  const me = organizar ? await requireAdmin() : await requireUser();
  return ok(await carregarPedidos({ id: me.id, is_admin: organizar }));
});

export const POST = route(async (req) => {
  const me = await requireUser();
  const body = await readJson<Record<string, unknown>>(req);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Dados inválidos.');
  const nome = cleanText(body.nome, 'o nome', 60);
  const parentesco = cleanText(body.parentesco, 'o parentesco', 120);
  const ano = edicaoAtual();
  const pedido = await transaction(async (q) => {
    await q('SELECT id FROM family_users WHERE id = $1 FOR UPDATE', [me.id]);
    const { rows: total } = await q<{ total: number }>(
      "SELECT count(*)::int AS total FROM invitation_requests WHERE user_id = $1 AND ano = $2 AND status = 'pendente'", [me.id, ano],
    );
    if (total[0].total >= 5) throw new HttpError(409, 'Aguarde a análise dos seus pedidos pendentes.');
    const { rows } = await q<{ id: number }>(
      `INSERT INTO invitation_requests (ano, user_id, nome, parentesco) VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING RETURNING id`, [ano, me.id, nome, parentesco],
    );
    if (!rows.length) throw new HttpError(409, 'Você já pediu esse convite. Aguarde a análise.');
    return rows[0];
  });
  const { rows: admins } = await query<{ id: number }>('SELECT id FROM family_users WHERE is_admin');
  void enviarPush(admins.map((p) => p.id), { titulo: 'Um novo parente vem aí!', corpo: 'Há um pedido de convite esperando sua aprovação.', rota: '/convites' });
  return ok(pedido, 201);
});
