-- Limite de tentativas de login e cadastro (contra força bruta). Idempotente.
CREATE TABLE IF NOT EXISTS auth_attempts (
  id BIGSERIAL PRIMARY KEY,
  chave TEXT NOT NULL,          -- 'ip:<ip>' ou 'user:<usuario>'
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_chave ON auth_attempts(chave, criado_em DESC);
