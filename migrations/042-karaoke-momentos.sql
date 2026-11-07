-- Karaokê: melhores momentos (fotos e clipes gravados no telão) e vídeo de melhores momentos (reel) de cada música.
-- Idempotente: pode rodar de novo.

CREATE TABLE IF NOT EXISTS karaoke_momentos (
  id          BIGSERIAL PRIMARY KEY,
  fila_id     BIGINT REFERENCES karaoke_fila(id) ON DELETE CASCADE,
  ano         INTEGER,
  user_id     INTEGER,
  tipo        TEXT CHECK (tipo IN ('foto', 'clipe', 'reel')),
  url         TEXT NOT NULL,
  ms          INTEGER,
  duracao_ms  INTEGER,
  motivo      TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS karaoke_momentos_fila ON karaoke_momentos (fila_id, id);
CREATE INDEX IF NOT EXISTS karaoke_momentos_ano ON karaoke_momentos (ano, id DESC);

ALTER TABLE karaoke_fila ADD COLUMN IF NOT EXISTS reel_status TEXT NULL;
ALTER TABLE karaoke_fila ADD COLUMN IF NOT EXISTS reel_url TEXT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'karaoke_fila_reel_status_check') THEN
    ALTER TABLE karaoke_fila ADD CONSTRAINT karaoke_fila_reel_status_check
      CHECK (reel_status IS NULL OR reel_status IN ('pendente', 'gerando', 'pronto', 'falhou'));
  END IF;
END $$;
