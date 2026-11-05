-- Pedidos privados de convite: somente o solicitante e quem organiza têm acesso.
CREATE TABLE IF NOT EXISTS invitation_requests (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL CHECK (char_length(nome) BETWEEN 1 AND 60),
  parentesco TEXT NOT NULL CHECK (char_length(parentesco) BETWEEN 1 AND 120),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'recusado')),
  invite_id INTEGER REFERENCES invites(id) ON DELETE SET NULL,
  reviewed_by INTEGER REFERENCES family_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_invitation_requests_user ON invitation_requests(ano, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invitation_requests_pending ON invitation_requests(ano, created_at) WHERE status = 'pendente';
CREATE UNIQUE INDEX IF NOT EXISTS idx_invitation_requests_duplicate ON invitation_requests(ano, user_id, lower(nome), lower(parentesco)) WHERE status = 'pendente';
