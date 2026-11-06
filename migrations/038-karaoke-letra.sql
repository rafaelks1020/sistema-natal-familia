-- Karaokê com letra própria sincronizada (LRCLIB): colunas novas na fila e ajuste de tempo lembrado por vídeo.
-- Idempotente: pode rodar de novo.

ALTER TABLE karaoke_fila ADD COLUMN IF NOT EXISTS faixa TEXT;
ALTER TABLE karaoke_fila ADD COLUMN IF NOT EXISTS artista TEXT;
ALTER TABLE karaoke_fila ADD COLUMN IF NOT EXISTS lrclib_id BIGINT;
ALTER TABLE karaoke_fila ADD COLUMN IF NOT EXISTS letra JSONB;
ALTER TABLE karaoke_fila ADD COLUMN IF NOT EXISTS offset_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE karaoke_fila ADD COLUMN IF NOT EXISTS modo TEXT NOT NULL DEFAULT 'video';

CREATE TABLE IF NOT EXISTS karaoke_ajustes (
  video_id TEXT PRIMARY KEY,
  offset_ms INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
