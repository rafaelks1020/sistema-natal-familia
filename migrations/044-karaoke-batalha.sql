-- Fila justa, prioridade manual e batalhas com duas apresentações individuais.
-- Somente criar o arquivo: aplicar manualmente no banco.
BEGIN;

CREATE TABLE IF NOT EXISTS karaoke_batalhas (
  id UUID PRIMARY KEY,
  ano INTEGER NOT NULL,
  criado_por INTEGER REFERENCES family_users(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  trechos JSONB NOT NULL CHECK (jsonb_typeof(trechos) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE karaoke_fila ADD COLUMN IF NOT EXISTS prioridade_manual INTEGER NULL;
ALTER TABLE karaoke_fila ADD COLUMN IF NOT EXISTS batalha_id UUID NULL REFERENCES karaoke_batalhas(id);
ALTER TABLE karaoke_fila ADD COLUMN IF NOT EXISTS batalha_rodada SMALLINT NULL;
ALTER TABLE karaoke_fila ADD COLUMN IF NOT EXISTS notas_linhas JSONB NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'karaoke_fila'::regclass AND conname = 'karaoke_fila_batalha_check') THEN
    ALTER TABLE karaoke_fila ADD CONSTRAINT karaoke_fila_batalha_check CHECK (
      (batalha_id IS NULL AND batalha_rodada IS NULL) OR
      (batalha_id IS NOT NULL AND batalha_rodada IS NOT NULL AND batalha_rodada IN (1, 2) AND dueto_user_id IS NULL)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'karaoke_fila'::regclass AND conname = 'karaoke_fila_notas_linhas_check') THEN
    ALTER TABLE karaoke_fila ADD CONSTRAINT karaoke_fila_notas_linhas_check
      CHECK (notas_linhas IS NULL OR jsonb_typeof(notas_linhas) = 'array');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS karaoke_fila_batalha_rodada ON karaoke_fila (batalha_id, batalha_rodada) WHERE batalha_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS karaoke_batalhas_ano ON karaoke_batalhas (ano, created_at DESC);

COMMIT;
