-- Revoga sessões antigas ao trocar a senha. Idempotente.
ALTER TABLE family_users ADD COLUMN IF NOT EXISTS session_version INT NOT NULL DEFAULT 1;
