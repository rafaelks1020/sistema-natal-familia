import {
  cleanText,
  HttpError,
  isBlobUrl,
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
import { carregarQuiz } from './_data';

function validarOpcoes(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 4) {
    throw new HttpError(400, 'Informe de 2 a 4 alternativas.');
  }
  return raw.map((item, idx) => cleanText(item, `Alternativa ${idx + 1}`, 120, true));
}

export const GET = route(async () => {
  const me = await requireUser();
  return ok(await carregarQuiz(me));
});

export const POST = route(async (req) => {
  const body = await readJson<Record<string, unknown>>(req);
  const acao = typeof body.acao === 'string' ? body.acao : '';
  const ano = edicaoAtual();

  if (acao === 'responder') {
    const me = await requireUser();
    const questionId = toInt(body.question_id, 'pergunta');
    const escolha = Number(body.escolha);
    if (!Number.isInteger(escolha) || escolha < 0 || escolha > 3) {
      throw new HttpError(400, 'Escolha uma alternativa válida.');
    }

    await transaction(async (q) => {
      const stateRes = await q<{
        status: string;
        question_id: number | null;
        elapsed_ms: number;
      }>(
        `SELECT status,
                question_id,
                CASE
                  WHEN aberta_em IS NOT NULL THEN
                    ROUND(EXTRACT(EPOCH FROM (NOW() - aberta_em)) * 1000)::int
                  ELSE 999999
                END AS elapsed_ms
           FROM party_quiz_state
          WHERE ano = $1
          FOR UPDATE`,
        [ano],
      );

      const st = stateRes.rows[0];
      if (!st || st.status !== 'aberta' || st.question_id !== questionId) {
        throw new HttpError(400, 'Esta pergunta não está aberta para respostas no momento.');
      }

      // Tolerancia de 1,5s para latencia de rede no clique final dos 20s
      if (st.elapsed_ms > 21_500) {
        await q(
          `UPDATE party_quiz_state
              SET status = 'revelada', encerrada_em = NOW(), updated_at = NOW()
            WHERE ano = $1`,
          [ano],
        );
        await q(`UPDATE party_quiz_questions SET encerrada = true WHERE id = $1 AND ano = $2`, [
          questionId,
          ano,
        ]);
        throw new HttpError(400, 'O tempo de 20 segundos acabou!');
      }

      const jaRes = await q(
        `SELECT 1 FROM party_quiz_answers WHERE ano = $1 AND question_id = $2 AND user_id = $3`,
        [ano, questionId, me.id],
      );
      if (jaRes.rowCount && jaRes.rowCount > 0) {
        throw new HttpError(400, 'Você já respondeu esta pergunta.');
      }

      const qRes = await q<{ opcoes: string[]; correta: number }>(
        `SELECT opcoes, correta FROM party_quiz_questions WHERE id = $1 AND ano = $2`,
        [questionId, ano],
      );
      const pergunta = qRes.rows[0];
      if (!pergunta) {
        throw new HttpError(404, 'Pergunta não encontrada.');
      }

      const opcoes = Array.isArray(pergunta.opcoes) ? pergunta.opcoes : [];
      if (escolha >= opcoes.length) {
        throw new HttpError(400, 'Alternativa fora da lista.');
      }

      const tempoMs = Math.max(0, Math.min(20_000, st.elapsed_ms));
      const acertou = escolha === pergunta.correta;
      const pontos = acertou ? 500 + Math.round(500 * (1 - tempoMs / 20_000)) : 0;

      await q(
        `INSERT INTO party_quiz_answers (ano, question_id, user_id, escolha, acertou, tempo_ms, pontos)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [ano, questionId, me.id, escolha, acertou, tempoMs, pontos],
      );
    });

    return ok(await carregarQuiz(me));
  }

  // Demais acoes sao exclusivas de quem organiza
  const admin = await requireAdmin();

  // A linha de estado so nasce aqui: o GET nao grava (sem linha vale 'preparando')
  await query(
    `INSERT INTO party_quiz_state (ano, status)
     VALUES ($1, 'preparando')
     ON CONFLICT (ano) DO NOTHING`,
    [ano],
  );

  if (acao === 'criar_pergunta') {
    const modelo = cleanText(body.modelo, 'Modelo', 80, false);
    const pergunta = cleanText(body.pergunta, 'Pergunta', 300, true);
    const opcoes = validarOpcoes(body.opcoes);
    const correta = Number(body.correta);
    if (!Number.isInteger(correta) || correta < 0 || correta >= opcoes.length) {
      throw new HttpError(400, 'Marque qual é a alternativa certa.');
    }

    let imageUrl: string | null = null;
    if (body.image_url) {
      if (!isBlobUrl(body.image_url)) {
        throw new HttpError(400, 'Envie a foto pelo botão de upload.');
      }
      imageUrl = body.image_url;
    }

    const ordemRes = await query<{ prox: number }>(
      `SELECT COALESCE(MAX(ordem), 0)::int + 1 AS prox FROM party_quiz_questions WHERE ano = $1`,
      [ano],
    );
    const ordem = ordemRes.rows[0]?.prox ?? 1;

    await query(
      `INSERT INTO party_quiz_questions (ano, ordem, modelo, pergunta, image_url, opcoes, correta, encerrada)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, false)`,
      [ano, ordem, modelo, pergunta, imageUrl, JSON.stringify(opcoes), correta],
    );

    return ok(await carregarQuiz(admin), 201);
  }

  if (acao === 'editar_pergunta') {
    const id = toInt(body.id, 'pergunta');
    const modelo = cleanText(body.modelo, 'Modelo', 80, false);
    const pergunta = cleanText(body.pergunta, 'Pergunta', 300, true);
    const opcoes = validarOpcoes(body.opcoes);
    const correta = Number(body.correta);
    if (!Number.isInteger(correta) || correta < 0 || correta >= opcoes.length) {
      throw new HttpError(400, 'Marque qual é a alternativa certa.');
    }

    let imageUrl: string | null = null;
    if (body.image_url) {
      if (!isBlobUrl(body.image_url)) {
        throw new HttpError(400, 'Envie a foto pelo botão de upload.');
      }
      imageUrl = body.image_url;
    }

    const up = await query(
      `UPDATE party_quiz_questions
          SET modelo = $1,
              pergunta = $2,
              image_url = $3,
              opcoes = $4::jsonb,
              correta = $5
        WHERE id = $6 AND ano = $7`,
      [modelo, pergunta, imageUrl, JSON.stringify(opcoes), correta, id, ano],
    );
    if (!up.rowCount) throw new HttpError(404, 'Pergunta não encontrada.');

    return ok(await carregarQuiz(admin));
  }

  if (acao === 'excluir_pergunta') {
    const id = toInt(body.id, 'pergunta');
    await transaction(async (q) => {
      // A FK composta tentaria zerar o ano (NOT NULL): solta o estado antes de apagar
      await q(
        `UPDATE party_quiz_state
            SET status = 'preparando',
                question_id = NULL,
                aberta_em = NULL,
                encerrada_em = NULL,
                updated_at = NOW()
          WHERE ano = $1 AND question_id = $2`,
        [ano, id],
      );
      await q(`DELETE FROM party_quiz_questions WHERE id = $1 AND ano = $2`, [id, ano]);
    });
    return ok(await carregarQuiz(admin));
  }

  if (acao === 'abrir_pergunta') {
    let questionId: number | null = body.question_id ? toInt(body.question_id, 'pergunta') : null;

    if (!questionId) {
      const nextRes = await query<{ id: number }>(
        `SELECT id FROM party_quiz_questions
          WHERE ano = $1 AND encerrada = false
          ORDER BY ordem ASC, id ASC
          LIMIT 1`,
        [ano],
      );
      questionId = nextRes.rows[0]?.id ?? null;
    }

    if (!questionId) {
      throw new HttpError(400, 'Não há mais perguntas pendentes para abrir.');
    }

    const qCheck = await query<{ id: number; pergunta: string }>(
      `SELECT id, pergunta FROM party_quiz_questions WHERE id = $1 AND ano = $2`,
      [questionId, ano],
    );
    if (!qCheck.rows[0]) {
      throw new HttpError(404, 'Pergunta não encontrada.');
    }

    await transaction(async (q) => {
      // Pergunta que estava no ar fica encerrada, senao o "abrir proxima" voltaria a ela
      await q(
        `UPDATE party_quiz_questions
            SET encerrada = true
          WHERE ano = $1
            AND id <> $2
            AND id = (SELECT question_id FROM party_quiz_state WHERE ano = $1 FOR UPDATE)`,
        [ano, questionId],
      );
      // Se reabriu uma pergunta especifica, limpa respostas anteriores daquela pergunta e marca como nao encerrada
      await q(`DELETE FROM party_quiz_answers WHERE ano = $1 AND question_id = $2`, [
        ano,
        questionId,
      ]);
      await q(`UPDATE party_quiz_questions SET encerrada = false WHERE id = $1 AND ano = $2`, [
        questionId,
        ano,
      ]);
      await q(
        `INSERT INTO party_quiz_state (ano, status, question_id, aberta_em, encerrada_em, updated_at)
         VALUES ($1, 'aberta', $2, NOW(), NULL, NOW())
         ON CONFLICT (ano) DO UPDATE
            SET status = 'aberta',
                question_id = EXCLUDED.question_id,
                aberta_em = NOW(),
                encerrada_em = NULL,
                updated_at = NOW()`,
        [ano, questionId],
      );
    });

    if (body.notificar) {
      const usersRes = await query<{ id: number }>(`SELECT id FROM family_users WHERE id <> $1`, [
        admin.id,
      ]);
      const ids = usersRes.rows.map((r) => r.id);
      void enviarPush(ids, {
        titulo: 'Quiz da Família ao vivo!',
        corpo: 'Uma nova pergunta acabou de abrir. Você tem 20 segundos!',
        rota: '/festa-quiz',
      });
    }

    return ok(await carregarQuiz(admin));
  }

  if (acao === 'encerrar_pergunta') {
    await transaction(async (q) => {
      const st = await q<{ question_id: number | null }>(
        `UPDATE party_quiz_state
            SET status = 'revelada',
                encerrada_em = NOW(),
                updated_at = NOW()
          WHERE ano = $1
          RETURNING question_id`,
        [ano],
      );
      const qId = st.rows[0]?.question_id;
      if (qId) {
        await q(`UPDATE party_quiz_questions SET encerrada = true WHERE id = $1 AND ano = $2`, [
          qId,
          ano,
        ]);
      }
    });
    return ok(await carregarQuiz(admin));
  }

  if (acao === 'mostrar_podio') {
    await transaction(async (q) => {
      const st = await q<{ question_id: number | null }>(
        `UPDATE party_quiz_state
            SET status = 'podio',
                encerrada_em = COALESCE(encerrada_em, NOW()),
                updated_at = NOW()
          WHERE ano = $1
          RETURNING question_id`,
        [ano],
      );
      const qId = st.rows[0]?.question_id;
      if (qId) {
        await q(`UPDATE party_quiz_questions SET encerrada = true WHERE id = $1 AND ano = $2`, [
          qId,
          ano,
        ]);
      }
    });
    return ok(await carregarQuiz(admin));
  }

  if (acao === 'voltar_preparacao') {
    await query(
      `UPDATE party_quiz_state
          SET status = 'preparando',
              question_id = NULL,
              aberta_em = NULL,
              encerrada_em = NULL,
              updated_at = NOW()
        WHERE ano = $1`,
      [ano],
    );
    return ok(await carregarQuiz(admin));
  }

  if (acao === 'reiniciar_quiz') {
    await transaction(async (q) => {
      await q(`DELETE FROM party_quiz_answers WHERE ano = $1`, [ano]);
      await q(`UPDATE party_quiz_questions SET encerrada = false WHERE ano = $1`, [ano]);
      await q(
        `UPDATE party_quiz_state
            SET status = 'preparando',
                question_id = NULL,
                aberta_em = NULL,
                encerrada_em = NULL,
                updated_at = NOW()
          WHERE ano = $1`,
        [ano],
      );
    });
    return ok(await carregarQuiz(admin));
  }

  throw new HttpError(400, 'Ação desconhecida.');
});
