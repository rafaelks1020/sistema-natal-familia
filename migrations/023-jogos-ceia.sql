-- Jogos da ceia: quiz da familia, bingo da ceia e enquete ao vivo.
-- Idempotente. Aplicacao pelo orquestrador.

-- 1) QUIZ DA FAMILIA
CREATE TABLE IF NOT EXISTS party_quiz_questions (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  modelo TEXT NOT NULL DEFAULT '' CHECK (char_length(modelo) <= 80),
  pergunta TEXT NOT NULL CHECK (char_length(pergunta) BETWEEN 1 AND 300),
  image_url TEXT,
  opcoes JSONB NOT NULL,
  correta INTEGER NOT NULL CHECK (correta >= 0 AND correta <= 3),
  encerrada BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, ano)
);
CREATE INDEX IF NOT EXISTS party_quiz_questions_ano_ordem ON party_quiz_questions (ano, ordem ASC, id ASC);

CREATE TABLE IF NOT EXISTS party_quiz_state (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'preparando' CHECK (status IN ('preparando', 'aberta', 'revelada', 'podio')),
  question_id INTEGER,
  aberta_em TIMESTAMPTZ,
  encerrada_em TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (question_id, ano) REFERENCES party_quiz_questions(id, ano) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS party_quiz_answers (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  escolha INTEGER NOT NULL CHECK (escolha >= 0 AND escolha <= 3),
  acertou BOOLEAN NOT NULL DEFAULT false,
  tempo_ms INTEGER NOT NULL DEFAULT 0,
  pontos INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (question_id, ano) REFERENCES party_quiz_questions(id, ano) ON DELETE CASCADE,
  UNIQUE (question_id, user_id)
);
CREATE INDEX IF NOT EXISTS party_quiz_answers_ano_user ON party_quiz_answers (ano, user_id);
CREATE INDEX IF NOT EXISTS party_quiz_answers_question ON party_quiz_answers (question_id);

-- 2) BINGO DA CEIA
CREATE TABLE IF NOT EXISTS party_bingo_items (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  texto TEXT NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 140),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, ano)
);
CREATE INDEX IF NOT EXISTS party_bingo_items_ano ON party_bingo_items (ano, id ASC);

CREATE TABLE IF NOT EXISTS party_bingo_cards (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  casas JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ano, user_id),
  UNIQUE (id, ano)
);
CREATE INDEX IF NOT EXISTS party_bingo_cards_ano ON party_bingo_cards (ano);

CREATE TABLE IF NOT EXISTS party_bingo_marks (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  card_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  posicao INTEGER NOT NULL CHECK (posicao >= 0 AND posicao <= 24),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (card_id, ano) REFERENCES party_bingo_cards(id, ano) ON DELETE CASCADE,
  UNIQUE (card_id, posicao)
);
CREATE INDEX IF NOT EXISTS party_bingo_marks_user_ano ON party_bingo_marks (ano, user_id);

CREATE TABLE IF NOT EXISTS party_bingo_claims (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  card_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  padrao TEXT NOT NULL CHECK (char_length(padrao) BETWEEN 1 AND 60),
  posicoes JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'rejeitado')),
  confirmed_by INTEGER REFERENCES family_users(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (card_id, ano) REFERENCES party_bingo_cards(id, ano) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS party_bingo_claims_ano_data ON party_bingo_claims (ano, created_at DESC);

-- 3) ENQUETE AO VIVO
CREATE TABLE IF NOT EXISTS party_live_polls (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  pergunta TEXT NOT NULL CHECK (char_length(pergunta) BETWEEN 1 AND 240),
  opcoes JSONB NOT NULL,
  aberta BOOLEAN NOT NULL DEFAULT true,
  encerrada_em TIMESTAMPTZ,
  created_by INTEGER REFERENCES family_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, ano)
);
CREATE INDEX IF NOT EXISTS party_live_polls_ano_data ON party_live_polls (ano, created_at DESC);

CREATE TABLE IF NOT EXISTS party_live_poll_votes (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  poll_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  opcao_index INTEGER NOT NULL CHECK (opcao_index >= 0 AND opcao_index <= 5),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (poll_id, ano) REFERENCES party_live_polls(id, ano) ON DELETE CASCADE,
  UNIQUE (poll_id, user_id)
);
CREATE INDEX IF NOT EXISTS party_live_poll_votes_poll ON party_live_poll_votes (poll_id);
