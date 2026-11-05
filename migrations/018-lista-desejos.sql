-- Parte E: lista de desejos melhorada (faixa de preco em centavos, foto opcional, compras e avisos).
-- Idempotente: pode rodar mais de uma vez.

ALTER TABLE wish_list ADD COLUMN IF NOT EXISTS ano INTEGER;
UPDATE wish_list SET ano = EXTRACT(YEAR FROM created_at)::int WHERE ano IS NULL;
ALTER TABLE wish_list ALTER COLUMN ano SET DEFAULT 2026;
ALTER TABLE wish_list ALTER COLUMN ano SET NOT NULL;

ALTER TABLE wish_list ADD COLUMN IF NOT EXISTS price_min_cents INTEGER;
ALTER TABLE wish_list ADD COLUMN IF NOT EXISTS price_max_cents INTEGER;
ALTER TABLE wish_list ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE INDEX IF NOT EXISTS idx_wish_list_ano ON wish_list(ano, participant_id);

CREATE TABLE IF NOT EXISTS wish_list_compras (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL DEFAULT 2026,
  wish_id INTEGER NOT NULL REFERENCES wish_list(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wish_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_wish_list_compras_wish ON wish_list_compras(wish_id);
CREATE INDEX IF NOT EXISTS idx_wish_list_compras_user ON wish_list_compras(user_id);
CREATE INDEX IF NOT EXISTS idx_wish_list_compras_ano ON wish_list_compras(ano);
