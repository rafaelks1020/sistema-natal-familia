-- Tokens nativos APNs e FCM. Idempotente.
CREATE TABLE IF NOT EXISTS push_devices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  token TEXT NOT NULL UNIQUE CHECK (length(token) BETWEEN 1 AND 512),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  disabled_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_push_devices_user_id ON push_devices(user_id);
