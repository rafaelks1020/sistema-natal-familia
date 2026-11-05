-- Cápsula do tempo, árvore genealógica e homenagens. Pode executar novamente.
-- texto da cápsula fica vazio até abre_em: o conteúdo lacrado mora em texto_lacrado
-- e a API não devolve essa coluna antes da hora. Assim uma denúncia antecipada
-- não leva o texto para quem organiza.

CREATE TABLE IF NOT EXISTS time_capsules (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  para_user_id INTEGER REFERENCES family_users(id) ON DELETE CASCADE,
  texto TEXT NOT NULL DEFAULT '',
  texto_lacrado TEXT NOT NULL,
  image_url TEXT,
  abre_em TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS time_capsules_ano_abre ON time_capsules (ano, abre_em);
CREATE INDEX IF NOT EXISTS time_capsules_user ON time_capsules (user_id);
CREATE INDEX IF NOT EXISTS time_capsules_abre_em ON time_capsules (abre_em);

CREATE TABLE IF NOT EXISTS family_tree_people (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  nome TEXT NOT NULL,
  apelido TEXT,
  foto_url TEXT,
  nascimento_ano INTEGER,
  falecimento_ano INTEGER,
  user_id INTEGER REFERENCES family_users(id) ON DELETE SET NULL,
  criado_por INTEGER REFERENCES family_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (nascimento_ano IS NULL OR nascimento_ano BETWEEN 1800 AND 2100),
  CHECK (falecimento_ano IS NULL OR falecimento_ano BETWEEN 1800 AND 2100),
  CHECK (falecimento_ano IS NULL OR nascimento_ano IS NULL OR falecimento_ano >= nascimento_ano)
);
CREATE INDEX IF NOT EXISTS family_tree_people_ano ON family_tree_people (ano, nome);
CREATE UNIQUE INDEX IF NOT EXISTS family_tree_people_conta
  ON family_tree_people (ano, user_id) WHERE user_id IS NOT NULL;

-- pai_mae: pessoa_id é o filho ou a filha, parente_id é o pai ou a mãe.
-- conjuge: pessoa_id < parente_id, um único par.
CREATE TABLE IF NOT EXISTS family_tree_links (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  pessoa_id INTEGER NOT NULL REFERENCES family_tree_people(id) ON DELETE CASCADE,
  parente_id INTEGER NOT NULL REFERENCES family_tree_people(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('pai_mae', 'conjuge')),
  criado_por INTEGER REFERENCES family_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (pessoa_id <> parente_id),
  CHECK (tipo <> 'conjuge' OR pessoa_id < parente_id),
  UNIQUE (pessoa_id, parente_id, tipo)
);
CREATE INDEX IF NOT EXISTS family_tree_links_pessoa ON family_tree_links (pessoa_id);
CREATE INDEX IF NOT EXISTS family_tree_links_parente ON family_tree_links (parente_id);
CREATE INDEX IF NOT EXISTS family_tree_links_ano ON family_tree_links (ano);

CREATE TABLE IF NOT EXISTS family_memorials (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  nome TEXT NOT NULL,
  foto_url TEXT,
  anos TEXT NOT NULL,
  texto TEXT NOT NULL DEFAULT '',
  pessoa_arvore_id INTEGER REFERENCES family_tree_people(id) ON DELETE SET NULL,
  criado_por INTEGER REFERENCES family_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS family_memorials_ano ON family_memorials (ano, created_at DESC);

CREATE TABLE IF NOT EXISTS family_tributes (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  memorial_id INTEGER NOT NULL REFERENCES family_memorials(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS family_tributes_memorial ON family_tributes (memorial_id, created_at);
CREATE INDEX IF NOT EXISTS family_tributes_user ON family_tributes (user_id);

CREATE TABLE IF NOT EXISTS family_memorial_candles (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  memorial_id INTEGER NOT NULL REFERENCES family_memorials(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (memorial_id, user_id, ano)
);
CREATE INDEX IF NOT EXISTS family_memorial_candles_memorial ON family_memorial_candles (memorial_id, ano);
