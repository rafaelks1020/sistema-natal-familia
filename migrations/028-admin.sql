-- Painel admin: registro de tudo que quem organiza altera. Idempotente: pode rodar de novo.
CREATE TABLE IF NOT EXISTS admin_log (
  id BIGSERIAL PRIMARY KEY,
  quando TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id INTEGER REFERENCES family_users(id) ON DELETE SET NULL,
  quem TEXT NOT NULL,
  acao TEXT NOT NULL,
  recurso TEXT NOT NULL,
  alvo_id TEXT,
  detalhe TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_log_quando ON admin_log (quando DESC);
