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
import { carregarEnquetes } from './_data';

function validarOpcoesEnquete(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 6) {
    throw new HttpError(400, 'Informe de 2 a 6 opções para a enquete.');
  }
  return raw.map((item, idx) => cleanText(item, `Opção ${idx + 1}`, 100, true));
}

export const GET = route(async () => {
  const me = await requireUser();
  return ok(await carregarEnquetes(me));
});

export const POST = route(async (req) => {
  const body = await readJson<Record<string, unknown>>(req);
  const acao = typeof body.acao === 'string' ? body.acao : '';
  const ano = edicaoAtual();

  if (acao === 'votar') {
    const me = await requireUser();
    const pollId = toInt(body.poll_id, 'enquete');
    const opcaoIndex = Number(body.opcao_index);
    if (!Number.isInteger(opcaoIndex) || opcaoIndex < 0 || opcaoIndex > 5) {
      throw new HttpError(400, 'Opção inválida.');
    }

    const pollRes = await query<{ aberta: boolean; opcoes: string[] }>(
      `SELECT aberta, opcoes FROM party_live_polls WHERE id = $1 AND ano = $2`,
      [pollId, ano],
    );
    const poll = pollRes.rows[0];
    if (!poll) {
      throw new HttpError(404, 'Enquete não encontrada.');
    }
    if (!poll.aberta) {
      throw new HttpError(400, 'Esta enquete já foi encerrada.');
    }
    const opcoes = Array.isArray(poll.opcoes) ? poll.opcoes : [];
    if (opcaoIndex >= opcoes.length) {
      throw new HttpError(400, 'Opção fora da lista.');
    }

    await query(
      `INSERT INTO party_live_poll_votes (ano, poll_id, user_id, opcao_index, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (poll_id, user_id) DO UPDATE
          SET opcao_index = EXCLUDED.opcao_index,
              updated_at = NOW()`,
      [ano, pollId, me.id, opcaoIndex],
    );

    return ok(await carregarEnquetes(me));
  }

  const admin = await requireAdmin();

  if (acao === 'criar') {
    const pergunta = cleanText(body.pergunta, 'Pergunta da enquete', 240, true);
    const opcoes = validarOpcoesEnquete(body.opcoes);

    await transaction(async (q) => {
      await q(
        `UPDATE party_live_polls
            SET aberta = false, encerrada_em = NOW()
          WHERE ano = $1 AND aberta = true`,
        [ano],
      );
      await q(
        `INSERT INTO party_live_polls (ano, pergunta, opcoes, aberta, created_by)
         VALUES ($1, $2, $3::jsonb, true, $4)`,
        [ano, pergunta, JSON.stringify(opcoes), admin.id],
      );
    });

    const usersRes = await query<{ id: number }>(`SELECT id FROM family_users WHERE id <> $1`, [
      admin.id,
    ]);
    void enviarPush(
      usersRes.rows.map((r) => r.id),
      {
        titulo: 'Enquete ao vivo na Ceia!',
        corpo: pergunta,
        rota: '/festa-enquete',
      },
    );

    return ok(await carregarEnquetes(admin), 201);
  }

  if (acao === 'encerrar') {
    const pollId = toInt(body.poll_id, 'enquete');
    const up = await query(
      `UPDATE party_live_polls
          SET aberta = false,
              encerrada_em = NOW()
        WHERE id = $1 AND ano = $2`,
      [pollId, ano],
    );
    if (!up.rowCount) throw new HttpError(404, 'Enquete não encontrada.');
    return ok(await carregarEnquetes(admin));
  }

  if (acao === 'reabrir') {
    const pollId = toInt(body.poll_id, 'enquete');
    await transaction(async (q) => {
      const existe = await q('SELECT 1 FROM party_live_polls WHERE id = $1 AND ano = $2', [pollId, ano]);
      if (!existe.rows.length) throw new HttpError(404, 'Enquete não encontrada.');
      await q(
        `UPDATE party_live_polls
            SET aberta = false, encerrada_em = NOW()
          WHERE ano = $1 AND aberta = true`,
        [ano],
      );
      await q(
        `UPDATE party_live_polls
            SET aberta = true, encerrada_em = NULL
          WHERE id = $1 AND ano = $2`,
        [pollId, ano],
      );
    });
    return ok(await carregarEnquetes(admin));
  }

  if (acao === 'excluir') {
    const pollId = toInt(body.poll_id, 'enquete');
    await query(`DELETE FROM party_live_polls WHERE id = $1 AND ano = $2`, [pollId, ano]);
    return ok(await carregarEnquetes(admin));
  }

  throw new HttpError(400, 'Ação desconhecida.');
});
