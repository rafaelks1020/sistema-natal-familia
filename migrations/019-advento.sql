-- Calendário do Advento (1 a 24 de dezembro). Idempotente: pode rodar de novo.
-- Conteúdo de cada dia (o que não estiver aqui usa o texto padrão do servidor).

CREATE TABLE IF NOT EXISTS advent_windows (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  dia INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  texto TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  opcoes JSONB
);

ALTER TABLE advent_windows ADD COLUMN IF NOT EXISTS ano INTEGER;
ALTER TABLE advent_windows ADD COLUMN IF NOT EXISTS dia INTEGER;
ALTER TABLE advent_windows ADD COLUMN IF NOT EXISTS tipo TEXT;
ALTER TABLE advent_windows ADD COLUMN IF NOT EXISTS titulo TEXT;
ALTER TABLE advent_windows ADD COLUMN IF NOT EXISTS texto TEXT;
ALTER TABLE advent_windows ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE advent_windows ADD COLUMN IF NOT EXISTS opcoes JSONB;

ALTER TABLE advent_windows DROP CONSTRAINT IF EXISTS advent_windows_dia;
ALTER TABLE advent_windows ADD CONSTRAINT advent_windows_dia CHECK (dia BETWEEN 1 AND 24);
ALTER TABLE advent_windows DROP CONSTRAINT IF EXISTS advent_windows_tipo;
ALTER TABLE advent_windows ADD CONSTRAINT advent_windows_tipo CHECK (tipo IN ('foto', 'receita', 'enquete', 'desafio', 'pergunta'));
ALTER TABLE advent_windows DROP CONSTRAINT IF EXISTS advent_windows_opcoes;
ALTER TABLE advent_windows ADD CONSTRAINT advent_windows_opcoes CHECK (
  (tipo <> 'enquete' AND opcoes IS NULL)
  OR (tipo = 'enquete' AND jsonb_typeof(opcoes) = 'array' AND jsonb_array_length(opcoes) BETWEEN 2 AND 6)
);

CREATE UNIQUE INDEX IF NOT EXISTS advent_windows_ano_dia_idx ON advent_windows (ano, dia);

-- Resposta escrita (foto, receita, desafio, pergunta). Nome da tabela e coluna texto são fixos (denúncia).
CREATE TABLE IF NOT EXISTS advent_responses (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  dia INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE advent_responses ADD COLUMN IF NOT EXISTS ano INTEGER;
ALTER TABLE advent_responses ADD COLUMN IF NOT EXISTS dia INTEGER;
ALTER TABLE advent_responses ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE advent_responses ADD COLUMN IF NOT EXISTS texto TEXT;
ALTER TABLE advent_responses ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE advent_responses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE advent_responses DROP CONSTRAINT IF EXISTS advent_responses_dia;
ALTER TABLE advent_responses ADD CONSTRAINT advent_responses_dia CHECK (dia BETWEEN 1 AND 24);

CREATE UNIQUE INDEX IF NOT EXISTS advent_responses_pessoa_dia ON advent_responses (ano, dia, user_id);
CREATE INDEX IF NOT EXISTS advent_responses_user_idx ON advent_responses (user_id);
CREATE INDEX IF NOT EXISTS advent_responses_ano_dia_idx ON advent_responses (ano, dia, created_at);

-- Voto da enquete. Uma escolha por pessoa, que pode ser trocada.
CREATE TABLE IF NOT EXISTS advent_votes (
  ano INTEGER NOT NULL,
  dia INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  opcao TEXT NOT NULL,
  PRIMARY KEY (ano, dia, user_id)
);

ALTER TABLE advent_votes ADD COLUMN IF NOT EXISTS ano INTEGER;
ALTER TABLE advent_votes ADD COLUMN IF NOT EXISTS dia INTEGER;
ALTER TABLE advent_votes ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE advent_votes ADD COLUMN IF NOT EXISTS opcao TEXT;

ALTER TABLE advent_votes DROP CONSTRAINT IF EXISTS advent_votes_dia;
ALTER TABLE advent_votes ADD CONSTRAINT advent_votes_dia CHECK (dia BETWEEN 1 AND 24);
CREATE INDEX IF NOT EXISTS advent_votes_user_idx ON advent_votes (user_id);
CREATE INDEX IF NOT EXISTS advent_votes_ano_dia_idx ON advent_votes (ano, dia);

-- Portinha que a pessoa já abriu (além de ter respondido).
CREATE TABLE IF NOT EXISTS advent_opens (
  ano INTEGER NOT NULL,
  dia INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ano, dia, user_id)
);

ALTER TABLE advent_opens ADD COLUMN IF NOT EXISTS ano INTEGER;
ALTER TABLE advent_opens ADD COLUMN IF NOT EXISTS dia INTEGER;
ALTER TABLE advent_opens ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE advent_opens ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE advent_opens DROP CONSTRAINT IF EXISTS advent_opens_dia;
ALTER TABLE advent_opens ADD CONSTRAINT advent_opens_dia CHECK (dia BETWEEN 1 AND 24);
CREATE INDEX IF NOT EXISTS advent_opens_user_idx ON advent_opens (user_id);
