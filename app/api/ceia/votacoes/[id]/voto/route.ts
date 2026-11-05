import { HttpError, ok, readJson, requireUser, route, toInt } from '@/app/lib/api';
import { transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { carregarVotacoes } from '../../../dados';

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const me = await requireUser();
  const { id: bruto } = await params;
  const votacaoId = toInt(bruto, 'id');
  const body = await readJson<Record<string, unknown>>(req);
  const opcaoId = toInt(body.opcao_id, 'opcao_id');
  const ano = edicaoAtual();

  await transaction(async (q) => {
    const votacao = await q<{ id: number; aberta: boolean; ano: number }>(
      'SELECT id, aberta, ano FROM ceia_votacoes WHERE id = $1 FOR UPDATE',
      [votacaoId],
    );
    const linha = votacao.rows[0];
    if (!linha || linha.ano !== ano) throw new HttpError(404, 'Votação não encontrada.');
    if (!linha.aberta) throw new HttpError(400, 'Essa votação já encerrou.');
    const opcao = await q(
      'SELECT id FROM ceia_votacao_opcoes WHERE id = $1 AND votacao_id = $2',
      [opcaoId, votacaoId],
    );
    if (!opcao.rows.length) throw new HttpError(400, 'Escolha uma das opções.');
    await q(
      `INSERT INTO ceia_votos (ano, votacao_id, opcao_id, user_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (votacao_id, user_id)
       DO UPDATE SET opcao_id = EXCLUDED.opcao_id, ano = EXCLUDED.ano, created_at = NOW()`,
      [ano, votacaoId, opcaoId, me.id],
    );
  });

  const [votacao] = await carregarVotacoes(me, ano, votacaoId);
  if (!votacao) throw new HttpError(404, 'Votação não encontrada.');
  return ok(votacao);
});
