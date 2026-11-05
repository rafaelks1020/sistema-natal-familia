import { getSettings } from '@/app/(app)/_inicio/server';
import { HttpError, ok, readJson, requireAdmin, route, toInt } from '@/app/lib/api';
import { query, transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { carregarVotacoes, dataEventoValida } from '../../dados';
import { situacaoVotos, textoOpcao } from '../../tipos';

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const me = await requireAdmin();
  const { id: bruto } = await params;
  const id = toInt(bruto, 'id');
  const body = await readJson<Record<string, unknown>>(req);
  const acao = body.acao;
  if (acao !== 'encerrar' && acao !== 'aplicar') throw new HttpError(400, 'Escolha encerrar ou aplicar.');
  const ano = edicaoAtual();
  const [atual] = await carregarVotacoes(me, ano, id);
  if (!atual) throw new HttpError(404, 'Votação não encontrada.');

  if (acao === 'encerrar') {
    await query('UPDATE ceia_votacoes SET aberta = FALSE WHERE id = $1 AND ano = $2', [id, ano]);
    const [votacao] = await carregarVotacoes(me, ano, id);
    if (!votacao) throw new HttpError(404, 'Votação não encontrada.');
    return ok({ votacao });
  }

  if (atual.tipo !== 'local' && atual.tipo !== 'data') {
    throw new HttpError(400, 'Essa votação é só para a conversa. Ela não muda a data nem o local.');
  }
  const situacao = situacaoVotos(atual.opcoes);
  if (situacao === 'vazia') throw new HttpError(400, 'Ainda não há votos.');
  if (situacao === 'empate') throw new HttpError(400, 'As opções empataram. A família precisa desempatar antes de usar a resposta.');
  const maximo = Math.max(...atual.opcoes.map((opcao) => opcao.votos));
  const vencedor = atual.opcoes.find((opcao) => opcao.votos === maximo);
  if (!vencedor) throw new HttpError(400, 'Ainda não há votos.');

  if (atual.tipo === 'data') {
    if (!dataEventoValida(vencedor.texto)) {
      throw new HttpError(400, 'A data vencedora não está num formato que a ceia aceita.');
    }
  } else if (vencedor.texto.length > 500) {
    throw new HttpError(400, 'O local vencedor passou de 500 caracteres.');
  }

  await transaction(async (q) => {
    if (atual.tipo === 'data') {
      await q(
        `INSERT INTO app_settings (key, value, updated_at) VALUES ('event_date', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [vencedor.texto],
      );
    } else {
      await q(
        `INSERT INTO app_settings (key, value, updated_at) VALUES ('event_place', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [vencedor.texto],
      );
    }
    await q('UPDATE ceia_votacoes SET aberta = FALSE WHERE id = $1 AND ano = $2', [id, ano]);
  });

  const [votacao] = await carregarVotacoes(me, ano, id);
  if (!votacao) throw new HttpError(404, 'Votação não encontrada.');
  return ok({ votacao, evento: await getSettings(), aplicado: textoOpcao(atual.tipo, vencedor.texto) });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  await requireAdmin();
  const { id: bruto } = await params;
  const id = toInt(bruto, 'id');
  const apagada = await query('DELETE FROM ceia_votacoes WHERE id = $1 AND ano = $2', [id, edicaoAtual()]);
  if (!apagada.rowCount) throw new HttpError(404, 'Votação não encontrada.');
  return ok({ ok: true });
});
