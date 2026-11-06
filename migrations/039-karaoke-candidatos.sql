-- Karaokê: troca automática de vídeo quando o YouTube bloqueia o embed (erros 100, 101, 150, 153).
-- Idempotente: pode rodar de novo.

ALTER TABLE karaoke_fila ADD COLUMN IF NOT EXISTS candidatos JSONB;
ALTER TABLE karaoke_fila ADD COLUMN IF NOT EXISTS videos_falhos TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS karaoke_videos_bloqueados (
  video_id TEXT PRIMARY KEY,
  codigo INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
