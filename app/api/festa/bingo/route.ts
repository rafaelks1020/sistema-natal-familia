import {
  cleanText,
  HttpError,
  ok,
  readJson,
  requireAdmin,
  requireUser,
  route,
  toInt,
} from '@/app/lib/api';
import { query, transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { enviarPush } from '@/app/lib/push';
import {
  BingoItemRow,
  carregarBingo,
  detectarPadroesCompletos,
  montarCasasSorteadas,
} from './_data';

export const GET = route(async () => {
  const me = await requireUser();
  return ok(await carregarBingo(me));
});

export const POST = route(async (req) => {
  const body = await readJson<Record<string, unknown>>(req);
  const acao = typeof body.acao === 'string' ? body.acao : '';
  const ano = edicaoAtual();

  if (acao === 'alternar_casa') {
    const me = await requireUser();
    const posicao = Number(body.posicao);
    if (!Number.isInteger(posicao) || posicao < 0 || posicao > 24) {
      throw new HttpError(400, 'Casa inválida.');
    }
    if (posicao === 12) {
      return ok(await carregarBingo(me));
    }

    const cardRes = await query<{ id: number }>(
      `SELECT id FROM party_bingo_cards WHERE ano = $1 AND user_id = $2`,
      [ano, me.id],
    );
    const card = cardRes.rows[0];
    if (!card) {
      throw new HttpError(404, 'Cartela não encontrada.');
    }

    const delRes = await query(
      `DELETE FROM party_bingo_marks WHERE ano = $1 AND card_id = $2 AND user_id = $3 AND posicao = $4`,
      [ano, card.id, me.id, posicao],
    );

    if (!delRes.rowCount) {
      await query(
        `INSERT INTO party_bingo_marks (ano, card_id, user_id, posicao)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (card_id, posicao) DO NOTHING`,
        [ano, card.id, me.id, posicao],
      );
    }

    return ok(await carregarBingo(me));
  }

  if (acao === 'gritar_bingo') {
    const me = await requireUser();

    let padraoGritado = '';

    await transaction(async (q) => {
      const cardRes = await q<{ id: number }>(
        `SELECT id FROM party_bingo_cards WHERE ano = $1 AND user_id = $2 FOR UPDATE`,
        [ano, me.id],
      );
      const card = cardRes.rows[0];
      if (!card) {
        throw new HttpError(404, 'Sua cartela ainda não foi gerada.');
      }

      const marksRes = await q<{ posicao: number }>(
        `SELECT posicao FROM party_bingo_marks WHERE ano = $1 AND card_id = $2`,
        [ano, card.id],
      );
      const marcadasSet = new Set<number>([12, ...marksRes.rows.map((r) => r.posicao)]);
      const completos = detectarPadroesCompletos(marcadasSet);

      if (completos.length === 0) {
        throw new HttpError(
          400,
          'Complete uma linha, coluna ou diagonal inteira antes de gritar Bingo!',
        );
      }

      const existenteRes = await q<{ id: number }>(
        `SELECT id FROM party_bingo_claims
          WHERE ano = $1 AND card_id = $2 AND status IN ('pendente', 'confirmado')
          LIMIT 1`,
        [ano, card.id],
      );
      if (existenteRes.rows[0]) {
        throw new HttpError(400, 'Você já gritou Bingo nesta cartela! Aguarde a confirmação.');
      }

      const escolhido = completos[0];
      padraoGritado = escolhido.nome;

      await q(
        `INSERT INTO party_bingo_claims (ano, card_id, user_id, padrao, posicoes, status)
         VALUES ($1, $2, $3, $4, $5::jsonb, 'pendente')`,
        [ano, card.id, me.id, escolhido.nome, JSON.stringify(escolhido.posicoes)],
      );
    });

    const usersRes = await query<{ id: number }>(`SELECT id FROM family_users WHERE id <> $1`, [
      me.id,
    ]);
    const ids = usersRes.rows.map((r) => r.id);
    void enviarPush(ids, {
      titulo: 'BINGO na Ceia!',
      corpo: `${me.name} gritou Bingo (${padraoGritado})! Confira na roda.`,
      rota: '/festa-bingo',
    });

    return ok(await carregarBingo(me));
  }

  if (acao === 'nova_cartela') {
    const me = await requireUser();
    const itensRes = await query<BingoItemRow>(
      `SELECT id, texto, ativo FROM party_bingo_items WHERE ano = $1 AND ativo = true ORDER BY id ASC`,
      [ano],
    );
    const novasCasas = montarCasasSorteadas(itensRes.rows);

    await transaction(async (q) => {
      const cardRes = await q<{ id: number }>(
        `UPDATE party_bingo_cards
            SET casas = $1::jsonb
          WHERE ano = $2 AND user_id = $3
          RETURNING id`,
        [JSON.stringify(novasCasas), ano, me.id],
      );
      const cardId = cardRes.rows[0]?.id;
      if (cardId) {
        await q(`DELETE FROM party_bingo_marks WHERE ano = $1 AND card_id = $2 AND posicao <> 12`, [
          ano,
          cardId,
        ]);
        await q(
          `DELETE FROM party_bingo_claims WHERE ano = $1 AND card_id = $2 AND status = 'pendente'`,
          [ano, cardId],
        );
      }
    });

    return ok(await carregarBingo(me));
  }

  // Acoes administrativas de quem organiza
  const admin = await requireAdmin();

  if (acao === 'confirmar_bingo') {
    const claimId = toInt(body.claim_id, 'pedido de bingo');
    const decisao = body.decisao === 'rejeitado' ? 'rejeitado' : 'confirmado';

    const upRes = await query<{ user_id: number; padrao: string }>(
      `UPDATE party_bingo_claims
          SET status = $1,
              confirmed_by = $2,
              confirmed_at = NOW()
        WHERE id = $3 AND ano = $4 AND status = 'pendente'
        RETURNING user_id, padrao`,
      [decisao, admin.id, claimId, ano],
    );

    const claim = upRes.rows[0];
    if (!claim) {
      throw new HttpError(404, 'Pedido de Bingo não encontrado ou já decidido.');
    }

    if (decisao === 'confirmado') {
      const uRes = await query<{ name: string }>(`SELECT name FROM family_users WHERE id = $1`, [
        claim.user_id,
      ]);
      const winnerName = uRes.rows[0]?.name ?? 'Alguém da família';
      const allRes = await query<{ id: number }>(`SELECT id FROM family_users WHERE id <> $1`, [
        admin.id,
      ]);
      void enviarPush(
        allRes.rows.map((r) => r.id),
        {
          titulo: 'Bingo confirmado!',
          corpo: `${winnerName} venceu o Bingo da Ceia (${claim.padrao})!`,
          rota: '/festa-bingo',
        },
      );
    }

    return ok(await carregarBingo(admin));
  }

  if (acao === 'adicionar_item') {
    const texto = cleanText(body.texto, 'Situação do bingo', 140, true);
    await query(`INSERT INTO party_bingo_items (ano, texto, ativo) VALUES ($1, $2, true)`, [
      ano,
      texto,
    ]);
    return ok(await carregarBingo(admin), 201);
  }

  if (acao === 'editar_item') {
    const id = toInt(body.id, 'item');
    const texto = cleanText(body.texto, 'Situação do bingo', 140, true);
    const ativo = body.ativo === undefined ? true : Boolean(body.ativo);
    const up = await query(
      `UPDATE party_bingo_items SET texto = $1, ativo = $2 WHERE id = $3 AND ano = $4`,
      [texto, ativo, id, ano],
    );
    if (!up.rowCount) throw new HttpError(404, 'Situação não encontrada.');
    return ok(await carregarBingo(admin));
  }

  if (acao === 'excluir_item') {
    const id = toInt(body.id, 'item');
    await query(`DELETE FROM party_bingo_items WHERE id = $1 AND ano = $2`, [id, ano]);
    return ok(await carregarBingo(admin));
  }

  throw new HttpError(400, 'Ação desconhecida.');
});
