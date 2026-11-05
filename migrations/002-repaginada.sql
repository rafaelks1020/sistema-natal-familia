-- Repaginada Meia-Noite (2026): sessão no servidor, admin por usuário, vínculo por id e configurações.
-- Idempotente: pode rodar mais de uma vez.

ALTER TABLE family_users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE family_users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE family_users ADD COLUMN IF NOT EXISTS bio TEXT;

-- Participante (quem entra na vaquinha e no sorteio) ligado ao login do parente.
ALTER TABLE participants ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES family_users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_user ON participants(user_id) WHERE user_id IS NOT NULL;

-- Presença: uma linha por participante.
CREATE UNIQUE INDEX IF NOT EXISTS idx_family_attendance_unique ON family_attendance(participant_id);

-- Várias fotos por post (JSON em texto, igual a purchases.image_urls).
ALTER TABLE family_posts ADD COLUMN IF NOT EXISTS image_urls TEXT;
ALTER TABLE family_posts ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE family_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Configurações do evento (chave/valor).
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO app_settings (key, value) VALUES
  ('event_title', 'Ceia de Natal'),
  ('event_date', '2026-12-24T20:00:00-03:00'),
  ('event_place', ''),
  ('contribution_value', '50')
ON CONFLICT (key) DO NOTHING;
