-- Acessos diários (gráficos do admin) e avisos agendados. Idempotente: pode rodar de novo.
-- family_daily_visits: no máximo uma linha por pessoa por dia (São Paulo).
-- admin_scheduled_pushes.user_ids nulo significa toda a família.

ALTER TABLE family_users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS family_daily_visits (
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  dia DATE NOT NULL,
  primeira TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultima TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, dia)
);
CREATE INDEX IF NOT EXISTS idx_family_daily_visits_dia ON family_daily_visits (dia);

CREATE TABLE IF NOT EXISTS admin_scheduled_pushes (
  id SERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  corpo TEXT NOT NULL,
  rota TEXT,
  user_ids INTEGER[],
  enviar_em TIMESTAMPTZ NOT NULL,
  enviado_em TIMESTAMPTZ,
  criado_por INTEGER REFERENCES family_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_scheduled_pushes_titulo CHECK (char_length(btrim(titulo)) BETWEEN 1 AND 80),
  CONSTRAINT admin_scheduled_pushes_corpo CHECK (char_length(btrim(corpo)) BETWEEN 1 AND 240),
  CONSTRAINT admin_scheduled_pushes_rota CHECK (
    rota IS NULL OR (char_length(rota) <= 101 AND rota ~ '^/[A-Za-z0-9_/-]*$')
  )
);
CREATE INDEX IF NOT EXISTS idx_admin_scheduled_pushes_pendentes
  ON admin_scheduled_pushes (enviar_em)
  WHERE enviado_em IS NULL;
