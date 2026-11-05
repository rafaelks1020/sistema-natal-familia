import { HttpError } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { enviarPush } from '@/app/lib/push';
import { atualizarPagamento, type PaymentRow } from '@/app/lib/pagamentos';
import type { SessionUser } from '@/app/lib/session';
// Reaproveita as rotas que já existem (mesmas regras e travas), chamadas por dentro e com a sessão desta requisição.
import { PUT as alterarOrganizador } from '@/app/api/family/[id]/admin/route';
import { POST as gerarSenha } from '@/app/api/family/[id]/reset-password/route';
import { POST as resolverDenuncia } from '@/app/api/reports/[id]/resolve/route';
import type { Recurso } from './recursos';

export interface ContextoAcao { id: number | string; me: SessionUser; recurso: Recurso }
export interface ResultadoAcao { mensagem?: string; senha_temporaria?: string; detalhe?: string }

const URL_INTERNA = 'http://interno.local/';

async function lerResposta(res: Response): Promise<Record<string, any>> {
  const dados = await res.json().catch(() => null);
  if (!res.ok) throw new HttpError(res.status, (dados as { error?: string } | null)?.error ?? 'Não deu certo. Tente de novo.');
  return (dados ?? {}) as Record<string, any>;
}
const ctxId = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) });
const json = (metodo: string, corpo?: unknown) => ({
  method: metodo,
  headers: { 'Content-Type': 'application/json' },
  ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
});

function exigirAfetou(rowCount: number | null, mensagem: string) {
  if (!rowCount) throw new HttpError(404, mensagem);
}

const STATUS_PAGAMENTO: Record<string, string> = {
  PAID: 'Pago', CREATED: 'Criado', REGISTERED: 'Aguardando pagamento', CANCELED: 'Cancelado',
  CANCELLED: 'Cancelado', EXPIRED: 'Vencido', SUBSTITUIDO: 'Substituído',
};

export const ACOES: Record<string, (c: ContextoAcao) => Promise<ResultadoAcao>> = {
  // ----- pessoas -----
  'pessoas:tornar_admin': async ({ id }) => {
    await lerResposta(await alterarOrganizador(new Request(URL_INTERNA, json('PUT', { is_admin: true })), ctxId(id)));
    return { mensagem: 'Agora essa pessoa é organizadora.' };
  },
  'pessoas:remover_admin': async ({ id, me }) => {
    if (id === me.id) throw new HttpError(400, 'Você não pode tirar a própria organização.');
    await lerResposta(await alterarOrganizador(new Request(URL_INTERNA, json('PUT', { is_admin: false })), ctxId(id)));
    return { mensagem: 'Acesso de organizador removido.' };
  },
  'pessoas:resetar_senha': async ({ id, me }) => {
    if (id === me.id) throw new HttpError(400, 'Para trocar a sua senha, use o seu perfil.');
    const dados = await lerResposta(await gerarSenha(new Request(URL_INTERNA, json('POST')), ctxId(id)));
    return {
      mensagem: 'Senha temporária gerada. Ela só aparece desta vez.',
      senha_temporaria: String(dados.password),
      detalhe: 'senha temporária gerada',
    };
  },
  'pessoas:encerrar_sessoes': async ({ id, me }) => {
    if (id === me.id) throw new HttpError(400, 'Para sair da sua conta, use o botão Sair.');
    const res = await query('UPDATE family_users SET session_version = session_version + 1 WHERE id = $1', [id]);
    exigirAfetou(res.rowCount, 'Pessoa não encontrada.');
    return { mensagem: 'Sessões encerradas. A pessoa precisará entrar de novo.' };
  },

  // ----- convites -----
  'convites:revogar': async ({ id }) => {
    const res = await query('UPDATE invites SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL', [id]);
    exigirAfetou(res.rowCount, 'Convite não encontrado ou já cancelado.');
    return { mensagem: 'Convite cancelado. O link parou de funcionar.' };
  },
  'pedidos_convite:recusar': async ({ id, me }) => {
    const res = await query(
      `UPDATE invitation_requests SET status = 'recusado', reviewed_by = $2, reviewed_at = NOW() WHERE id = $1 AND status = 'pendente'`,
      [id, me.id],
    );
    exigirAfetou(res.rowCount, 'Pedido não encontrado ou já decidido.');
    return { mensagem: 'Pedido recusado.' };
  },

  // ----- denúncias (mesma lógica de /api/reports/[id]/resolve) -----
  'denuncias:apagar_conteudo': async ({ id }) => {
    await lerResposta(await resolverDenuncia(new Request(URL_INTERNA, json('POST', { acao: 'apagar' })), ctxId(id)));
    return { mensagem: 'Conteúdo apagado e denúncia resolvida.' };
  },
  'denuncias:manter': async ({ id }) => {
    await lerResposta(await resolverDenuncia(new Request(URL_INTERNA, json('POST', { acao: 'manter' })), ctxId(id)));
    return { mensagem: 'Conteúdo mantido e denúncia resolvida.' };
  },

  // ----- pagamentos: só consulta o banco; nunca edita valor nem situação à mão -----
  'pagamentos:conferir_no_banco': async ({ id }) => {
    const { rows } = await query<PaymentRow>('SELECT * FROM payments WHERE id = $1', [id]);
    if (!rows[0]) throw new HttpError(404, 'Pagamento não encontrado.');
    let atual: PaymentRow;
    try {
      atual = await atualizarPagamento(rows[0]);
    } catch (err) {
      console.error('[admin] conferir pagamento:', (err as Error).message);
      throw new HttpError(502, 'Não consegui consultar o banco agora. Tente de novo em instantes.');
    }
    const nome = STATUS_PAGAMENTO[atual.status] ?? atual.status;
    return { mensagem: `Situação no banco: ${nome}.`, detalhe: `situação: ${atual.status}` };
  },

  // ----- bingo -----
  'bingo_pedidos:confirmar': async ({ id, me }) => decidirBingo(id, me, 'confirmado'),
  'bingo_pedidos:rejeitar': async ({ id, me }) => decidirBingo(id, me, 'rejeitado'),

  // ----- enquete ao vivo -----
  'enquetes_ao_vivo:encerrar': async ({ id }) => {
    const res = await query('UPDATE party_live_polls SET aberta = false, encerrada_em = NOW() WHERE id = $1 AND aberta', [id]);
    exigirAfetou(res.rowCount, 'Enquete não encontrada ou já encerrada.');
    return { mensagem: 'Enquete encerrada.' };
  },
};

async function decidirBingo(id: number | string, me: SessionUser, decisao: 'confirmado' | 'rejeitado'): Promise<ResultadoAcao> {
  const { rows } = await query<{ user_id: number; padrao: string }>(
    `UPDATE party_bingo_claims SET status = $1, confirmed_by = $2, confirmed_at = NOW()
      WHERE id = $3 AND status = 'pendente' RETURNING user_id, padrao`,
    [decisao, me.id, id],
  );
  const pedido = rows[0];
  if (!pedido) throw new HttpError(404, 'Pedido de bingo não encontrado ou já decidido.');
  if (decisao === 'confirmado') {
    // Mesmo aviso que a tela do bingo manda ao confirmar.
    const nome = (await query<{ name: string }>('SELECT name FROM family_users WHERE id = $1', [pedido.user_id])).rows[0]?.name ?? 'Alguém da família';
    const todos = await query<{ id: number }>('SELECT id FROM family_users WHERE id <> $1', [me.id]);
    void enviarPush(todos.rows.map((u) => u.id), {
      titulo: 'Bingo confirmado!', corpo: `${nome} venceu o Bingo da Ceia (${pedido.padrao})!`, rota: '/festa-bingo',
    });
  }
  return { mensagem: decisao === 'confirmado' ? 'Bingo confirmado e família avisada.' : 'Pedido de bingo rejeitado.' };
}
