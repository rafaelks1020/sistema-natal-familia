import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import type { SessionUser } from '@/app/lib/session';

export const QUIZ_DURACAO_SEGUNDOS = 20;

export const MODELOS_QUIZ = [
  'Quem disse isso?',
  'Que ano foi essa foto?',
  'Quem é o bebê da foto?',
] as const;

export interface QuizQuestionItem {
  id: number;
  ordem: number;
  modelo: string;
  pergunta: string;
  image_url: string | null;
  opcoes: string[];
  correta: number | null;
  encerrada: boolean;
  total_respostas: number;
}

export interface QuizRevealedAnswer {
  user_id: number;
  name: string;
  avatar_url: string | null;
  escolha: number;
  acertou: boolean;
  pontos: number;
  tempo_ms: number;
}

export interface QuizCurrentQuestion {
  id: number;
  numero: number;
  total: number;
  modelo: string;
  pergunta: string;
  image_url: string | null;
  opcoes: string[];
  correta: number | null;
  encerrada: boolean;
  total_respostas: number;
  minha_resposta: {
    escolha: number;
    acertou: boolean | null;
    pontos: number | null;
    tempo_ms: number;
  } | null;
  respostas_reveladas: QuizRevealedAnswer[];
}

export interface QuizLeaderboardEntry {
  user_id: number;
  name: string;
  avatar_url: string | null;
  pontos: number;
  acertos: number;
  respondidas: number;
  tempo_medio_ms: number;
}

export interface QuizData {
  ano: number;
  server_now: string;
  duracao_segundos: number;
  modelos: readonly string[];
  state: {
    status: 'preparando' | 'aberta' | 'revelada' | 'podio';
    question_id: number | null;
    aberta_em: string | null;
    encerrada_em: string | null;
    restante_ms: number;
  };
  pergunta_atual: QuizCurrentQuestion | null;
  placar: QuizLeaderboardEntry[];
  perguntas: QuizQuestionItem[];
}

export async function carregarQuiz(me: SessionUser): Promise<QuizData> {
  const ano = edicaoAtual();

  // Garante linha de estado para o ano atual e encerra automaticamente se os 20s expiraram
  await query(
    `INSERT INTO party_quiz_state (ano, status)
     VALUES ($1, 'preparando')
     ON CONFLICT (ano) DO NOTHING`,
    [ano],
  );

  const expiredRes = await query<{ question_id: number | null }>(
    `UPDATE party_quiz_state
        SET status = 'revelada',
            encerrada_em = NOW(),
            updated_at = NOW()
      WHERE ano = $1
        AND status = 'aberta'
        AND aberta_em IS NOT NULL
        AND NOW() >= aberta_em + INTERVAL '20 seconds'
      RETURNING question_id`,
    [ano],
  );

  if (expiredRes.rows[0]?.question_id) {
    await query(
      `UPDATE party_quiz_questions
          SET encerrada = true
        WHERE id = $1 AND ano = $2`,
      [expiredRes.rows[0].question_id, ano],
    );
  }

  const stateRes = await query<{
    status: 'preparando' | 'aberta' | 'revelada' | 'podio';
    question_id: number | null;
    aberta_em: string | null;
    encerrada_em: string | null;
    agora: string;
    restante_ms: number;
  }>(
    `SELECT status,
            question_id,
            aberta_em::text AS aberta_em,
            encerrada_em::text AS encerrada_em,
            NOW()::text AS agora,
            CASE
              WHEN status = 'aberta' AND aberta_em IS NOT NULL THEN
                GREATEST(0, ROUND(EXTRACT(EPOCH FROM ((aberta_em + INTERVAL '20 seconds') - NOW())) * 1000))::int
              ELSE 0
            END AS restante_ms
       FROM party_quiz_state
      WHERE ano = $1`,
    [ano],
  );

  const st = stateRes.rows[0] ?? {
    status: 'preparando' as const,
    question_id: null,
    aberta_em: null,
    encerrada_em: null,
    agora: new Date().toISOString(),
    restante_ms: 0,
  };

  const questionsRes = await query<{
    id: number;
    ordem: number;
    modelo: string;
    pergunta: string;
    image_url: string | null;
    opcoes: string[];
    correta: number;
    encerrada: boolean;
    total_respostas: number;
  }>(
    `SELECT q.id,
            q.ordem,
            q.modelo,
            q.pergunta,
            q.image_url,
            q.opcoes,
            q.correta,
            q.encerrada,
            COUNT(a.id)::int AS total_respostas
       FROM party_quiz_questions q
       LEFT JOIN party_quiz_answers a ON a.question_id = q.id AND a.ano = q.ano
      WHERE q.ano = $1
      GROUP BY q.id
      ORDER BY q.ordem ASC, q.id ASC`,
    [ano],
  );

  const rawQuestions = questionsRes.rows;

  // O servidor NUNCA envia a resposta certa antes de encerrar a pergunta.
  const perguntas: QuizQuestionItem[] = rawQuestions.map((q) => {
    const isCurrentOpen = st.status === 'aberta' && st.question_id === q.id;
    const podeVerCorreta = q.encerrada && !isCurrentOpen;
    return {
      id: q.id,
      ordem: q.ordem,
      modelo: q.modelo,
      pergunta: q.pergunta,
      image_url: q.image_url,
      opcoes: Array.isArray(q.opcoes) ? q.opcoes.map(String) : [],
      correta: podeVerCorreta ? q.correta : null,
      encerrada: q.encerrada,
      total_respostas: q.total_respostas,
    };
  });

  let pergunta_atual: QuizCurrentQuestion | null = null;
  if (st.question_id) {
    const idx = rawQuestions.findIndex((q) => q.id === st.question_id);
    if (idx !== -1) {
      const q = rawQuestions[idx];
      const jaEncerrada = st.status !== 'aberta' && q.encerrada;

      const minhaRes = await query<{
        escolha: number;
        acertou: boolean;
        pontos: number;
        tempo_ms: number;
      }>(
        `SELECT escolha, acertou, pontos, tempo_ms
           FROM party_quiz_answers
          WHERE ano = $1 AND question_id = $2 AND user_id = $3`,
        [ano, q.id, me.id],
      );

      const m = minhaRes.rows[0] ?? null;

      let respostas_reveladas: QuizRevealedAnswer[] = [];
      if (jaEncerrada) {
        const revRes = await query<QuizRevealedAnswer>(
          `SELECT a.user_id,
                  u.name,
                  u.avatar_url,
                  a.escolha,
                  a.acertou,
                  a.pontos,
                  a.tempo_ms
             FROM party_quiz_answers a
             JOIN family_users u ON u.id = a.user_id
            WHERE a.ano = $1
              AND a.question_id = $2
              AND NOT EXISTS (
                SELECT 1 FROM user_blocks b
                 WHERE (b.blocker_id = $3 AND b.blocked_id = a.user_id)
                    OR (b.blocker_id = a.user_id AND b.blocked_id = $3)
              )
            ORDER BY a.pontos DESC, a.tempo_ms ASC`,
          [ano, q.id, me.id],
        );
        respostas_reveladas = revRes.rows;
      }

      pergunta_atual = {
        id: q.id,
        numero: idx + 1,
        total: rawQuestions.length,
        modelo: q.modelo,
        pergunta: q.pergunta,
        image_url: q.image_url,
        opcoes: Array.isArray(q.opcoes) ? q.opcoes.map(String) : [],
        correta: jaEncerrada ? q.correta : null,
        encerrada: jaEncerrada,
        total_respostas: q.total_respostas,
        minha_resposta: m
          ? {
              escolha: m.escolha,
              acertou: jaEncerrada ? m.acertou : null,
              pontos: jaEncerrada ? m.pontos : null,
              tempo_ms: m.tempo_ms,
            }
          : null,
        respostas_reveladas,
      };
    }
  }

  // Placar ao vivo: contabiliza somente perguntas ja encerradas para nao revelar acerto antes da hora
  const placarRes = await query<QuizLeaderboardEntry>(
    `SELECT a.user_id,
            u.name,
            u.avatar_url,
            COALESCE(SUM(a.pontos), 0)::int AS pontos,
            COALESCE(SUM(CASE WHEN a.acertou THEN 1 ELSE 0 END), 0)::int AS acertos,
            COUNT(a.id)::int AS respondidas,
            COALESCE(ROUND(AVG(a.tempo_ms)), 0)::int AS tempo_medio_ms
       FROM party_quiz_answers a
       JOIN party_quiz_questions q ON q.id = a.question_id AND q.ano = a.ano
       JOIN family_users u ON u.id = a.user_id
      WHERE a.ano = $1
        AND q.encerrada = true
        AND NOT (q.id = COALESCE($2, -1) AND $3 = 'aberta')
        AND NOT EXISTS (
          SELECT 1 FROM user_blocks b
           WHERE (b.blocker_id = $4 AND b.blocked_id = a.user_id)
              OR (b.blocker_id = a.user_id AND b.blocked_id = $4)
        )
      GROUP BY a.user_id, u.name, u.avatar_url
      ORDER BY pontos DESC, acertos DESC, tempo_medio_ms ASC`,
    [ano, st.question_id, st.status, me.id],
  );

  return {
    ano,
    server_now: st.agora,
    duracao_segundos: QUIZ_DURACAO_SEGUNDOS,
    modelos: MODELOS_QUIZ,
    state: {
      status: st.status,
      question_id: st.question_id,
      aberta_em: st.aberta_em,
      encerrada_em: st.encerrada_em,
      restante_ms: st.restante_ms,
    },
    pergunta_atual,
    placar: placarRes.rows,
    perguntas,
  };
}
