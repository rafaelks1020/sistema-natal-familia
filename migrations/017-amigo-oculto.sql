-- Parte D: edições, dicas anônimas, palpites, histórico e revelação coletiva.
ALTER TABLE secret_santa_config ADD COLUMN IF NOT EXISTS ano INTEGER;
UPDATE secret_santa_config SET ano = EXTRACT(YEAR FROM created_at)::int WHERE ano IS NULL;
ALTER TABLE secret_santa_config ALTER COLUMN ano SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_santa_config_ano ON secret_santa_config(ano, is_active);

CREATE TABLE IF NOT EXISTS secret_santa_hints (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  config_id INTEGER NOT NULL REFERENCES secret_santa_config(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  receiver_participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  texto TEXT NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 280),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_santa_hints_receiver ON secret_santa_hints(ano, config_id, receiver_participant_id);
CREATE INDEX IF NOT EXISTS idx_santa_hints_daily ON secret_santa_hints(user_id, ano, created_at);
-- A cota permanece mesmo quando uma dica é apagada pela moderação ou o sorteio é refeito.
CREATE TABLE IF NOT EXISTS secret_santa_hint_days (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  dia DATE NOT NULL,
  total INTEGER NOT NULL CHECK (total BETWEEN 1 AND 3),
  UNIQUE(ano, user_id, dia)
);
CREATE TABLE IF NOT EXISTS secret_santa_guesses (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  config_id INTEGER NOT NULL REFERENCES secret_santa_config(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  guessed_participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(config_id, participant_id)
);
CREATE TABLE IF NOT EXISTS secret_santa_history (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  giver_participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  receiver_participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  revelado BOOLEAN NOT NULL DEFAULT false,
  CHECK (giver_participant_id <> receiver_participant_id),
  UNIQUE(ano, giver_participant_id),
  UNIQUE(ano, receiver_participant_id)
);
CREATE TABLE IF NOT EXISTS secret_santa_live (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL UNIQUE,
  config_id INTEGER NOT NULL REFERENCES secret_santa_config(id) ON DELETE CASCADE,
  ordem JSONB NOT NULL,
  atual INTEGER NOT NULL DEFAULT -1,
  iniciado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  encerrado_em TIMESTAMPTZ
);
INSERT INTO app_settings(key, value) VALUES
  ('amigo_tema', 'Livre'), ('amigo_valor', ''), ('amigo_evitar_repeticao', 'true')
ON CONFLICT(key) DO NOTHING;
