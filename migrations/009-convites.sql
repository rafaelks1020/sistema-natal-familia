-- Convites por link: o organizador gera, a pessoa se cadastra sem o código da família. Idempotente.
CREATE TABLE IF NOT EXISTS invites (
  id SERIAL PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,                                                   -- "Vó Maria", "Família toda"
  participant_id INTEGER REFERENCES participants(id) ON DELETE SET NULL, -- liga o cadastro a este participante
  max_uses INTEGER,                                                      -- null = sem limite
  uses INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMP,
  revoked_at TIMESTAMP,
  created_by INTEGER REFERENCES family_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invites_created ON invites(created_at DESC);

-- Quem entrou por qual convite.
ALTER TABLE family_users ADD COLUMN IF NOT EXISTS invite_id INTEGER REFERENCES invites(id) ON DELETE SET NULL;
