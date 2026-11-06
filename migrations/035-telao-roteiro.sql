-- Roteiro da noite no telao da TV. Idempotente: pode rodar de novo.
-- Define a programacao de cenas, avisos e momentos musicais por horario em cada edicao.

CREATE TABLE IF NOT EXISTS telao_roteiro (
  id BIGSERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  hora TIME NOT NULL,
  acao TEXT NOT NULL,
  texto TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE telao_roteiro ADD COLUMN IF NOT EXISTS ano INTEGER;
ALTER TABLE telao_roteiro ADD COLUMN IF NOT EXISTS hora TIME;
ALTER TABLE telao_roteiro ADD COLUMN IF NOT EXISTS acao TEXT;
ALTER TABLE telao_roteiro ADD COLUMN IF NOT EXISTS texto TEXT NULL;
ALTER TABLE telao_roteiro ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS telao_roteiro_ano_hora_idx ON telao_roteiro (ano, hora);

ALTER TABLE telao_roteiro DROP CONSTRAINT IF EXISTS telao_roteiro_acao;
ALTER TABLE telao_roteiro ADD CONSTRAINT telao_roteiro_acao CHECK (
  acao IN (
    'cena:fotos',
    'cena:tocando',
    'cena:contagem',
    'cena:recados',
    'cena:advento',
    'cena:virada',
    'cena:ceia',
    'cena:linha',
    'cena:lareira',
    'cena:papainoel',
    'cena:brinde',
    'cena:karaoke',
    'ciclo',
    'aviso'
  ) OR acao LIKE 'musica:%'
);
