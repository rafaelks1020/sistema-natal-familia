-- Karaokê próprio do Natal em Família: fila de músicas (vídeos de karaokê do YouTube) e notas das apresentações.
-- Idempotente: pode rodar de novo.

CREATE TABLE IF NOT EXISTS karaoke_fila (
  id BIGSERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  dueto_user_id INTEGER NULL REFERENCES family_users(id) ON DELETE SET NULL,
  video_id TEXT NOT NULL,
  titulo TEXT NOT NULL,
  canal TEXT NOT NULL DEFAULT '',
  duracao_s INTEGER NULL,
  miniatura TEXT NULL,
  status TEXT NOT NULL DEFAULT 'fila' CHECK (status IN ('fila', 'cantando', 'feita', 'pulada')),
  posicao INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  iniciado_em TIMESTAMPTZ NULL,
  terminado_em TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS karaoke_fila_ano_status ON karaoke_fila (ano, status, posicao, id);
CREATE INDEX IF NOT EXISTS karaoke_fila_user ON karaoke_fila (ano, user_id);

CREATE TABLE IF NOT EXISTS karaoke_notas (
  id BIGSERIAL PRIMARY KEY,
  fila_id BIGINT NOT NULL REFERENCES karaoke_fila(id) ON DELETE CASCADE,
  nota INTEGER NOT NULL CHECK (nota BETWEEN 0 AND 100),
  estrelas INTEGER NOT NULL CHECK (estrelas BETWEEN 1 AND 5),
  detalhes JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fila_id)
);
