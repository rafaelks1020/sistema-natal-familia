-- Karaokê modo estúdio: catálogo de músicas preparadas (instrumental, palavras e notas) e ligação com a fila.
-- Idempotente: pode rodar de novo.

CREATE TABLE IF NOT EXISTS karaoke_catalogo (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  artista TEXT NOT NULL,
  faixa TEXT NOT NULL,
  duracao_ms INTEGER,
  idioma TEXT,
  lrclib_id BIGINT,
  audio_url TEXT,
  capa_url TEXT,
  palavras JSONB,
  notas JSONB,
  status TEXT NOT NULL DEFAULT 'na_fila' CHECK (status IN ('na_fila', 'baixando', 'processando', 'pronta', 'falhou')),
  erro TEXT,
  pedido_por INTEGER NULL REFERENCES family_users(id) ON DELETE SET NULL,
  tentativas INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS karaoke_catalogo_status ON karaoke_catalogo (status, created_at);

ALTER TABLE karaoke_fila ADD COLUMN IF NOT EXISTS catalogo_id BIGINT NULL REFERENCES karaoke_catalogo(id) ON DELETE SET NULL;
