-- Moderação de conteúdo e aceite dos termos. Pode executar novamente.
ALTER TABLE family_users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS content_reports (
  id SERIAL PRIMARY KEY,
  reporter_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  post_id INTEGER REFERENCES family_posts(id) ON DELETE CASCADE,
  comment_id INTEGER REFERENCES family_post_comments(id) ON DELETE CASCADE,
  motivo TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP,
  CHECK ((post_id IS NOT NULL)::int + (comment_id IS NOT NULL)::int = 1)
);
CREATE INDEX IF NOT EXISTS idx_content_reports_pending ON content_reports(created_at) WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
