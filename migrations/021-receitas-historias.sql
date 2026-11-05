CREATE TABLE IF NOT EXISTS family_recipes (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  de_quem TEXT NOT NULL,
  categoria TEXT NOT NULL,
  foto_url TEXT,
  ingredientes TEXT NOT NULL,
  modo_preparo TEXT NOT NULL,
  segredo TEXT,
  audio_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS family_recipes_ano_categoria ON family_recipes(ano, categoria, created_at DESC);
CREATE INDEX IF NOT EXISTS family_recipes_user ON family_recipes(user_id);
CREATE TABLE IF NOT EXISTS family_stories (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  quem_conta TEXT NOT NULL,
  epoca TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  foto_url TEXT,
  transcricao TEXT,
  duracao_s INTEGER NOT NULL DEFAULT 0 CHECK (duracao_s >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS family_stories_ano ON family_stories(ano, created_at DESC);
CREATE INDEX IF NOT EXISTS family_stories_user ON family_stories(user_id);
