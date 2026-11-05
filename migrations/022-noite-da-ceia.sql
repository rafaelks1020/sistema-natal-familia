-- Noite da ceia. Aplicação pelo integrador, sem execução automática.
CREATE TABLE IF NOT EXISTS party_challenges (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  titulo TEXT NOT NULL CHECK (char_length(titulo) BETWEEN 1 AND 120),
  aberto BOOLEAN NOT NULL DEFAULT true,
  encerrado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, ano),
  CHECK ((aberto AND encerrado_em IS NULL) OR (NOT aberto AND encerrado_em IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS party_challenges_aberto_ano ON party_challenges (ano) WHERE aberto;
CREATE INDEX IF NOT EXISTS party_challenges_ano_data ON party_challenges (ano, created_at DESC);

CREATE TABLE IF NOT EXISTS party_photo_entries (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  desafio_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  legenda TEXT NOT NULL DEFAULT '' CHECK (char_length(legenda) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (desafio_id, ano) REFERENCES party_challenges(id, ano) ON DELETE CASCADE,
  UNIQUE (desafio_id, user_id),
  UNIQUE (id, desafio_id, ano)
);
CREATE INDEX IF NOT EXISTS party_photo_entries_ano_data ON party_photo_entries (ano, created_at DESC);
CREATE INDEX IF NOT EXISTS party_photo_entries_autor ON party_photo_entries (user_id);

CREATE TABLE IF NOT EXISTS party_photo_votes (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  desafio_id INTEGER NOT NULL,
  entry_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (desafio_id, ano) REFERENCES party_challenges(id, ano) ON DELETE CASCADE,
  FOREIGN KEY (entry_id, desafio_id, ano) REFERENCES party_photo_entries(id, desafio_id, ano) ON DELETE CASCADE,
  UNIQUE (desafio_id, user_id)
);
CREATE INDEX IF NOT EXISTS party_photo_votes_foto ON party_photo_votes (entry_id);

CREATE TABLE IF NOT EXISTS family_official_photos (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  legenda TEXT NOT NULL DEFAULT '' CHECK (char_length(legenda) <= 500),
  dica_pose TEXT NOT NULL DEFAULT '' CHECK (char_length(dica_pose) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
