-- Telão da TV controlado pelo celular de quem organiza. Idempotente: pode rodar de novo.
-- cena_fixa nulo = ciclo automático. comando guarda 'proxima', 'anterior' ou 'aviso:<texto curto>';
-- o telão executa cada comando uma vez, olhando comando_em.

CREATE TABLE IF NOT EXISTS telao_state (
  ano INTEGER PRIMARY KEY,
  cena_fixa TEXT,
  pausado BOOLEAN NOT NULL DEFAULT false,
  comando TEXT,
  comando_em TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE telao_state ADD COLUMN IF NOT EXISTS cena_fixa TEXT;
ALTER TABLE telao_state ADD COLUMN IF NOT EXISTS pausado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE telao_state ADD COLUMN IF NOT EXISTS comando TEXT;
ALTER TABLE telao_state ADD COLUMN IF NOT EXISTS comando_em TIMESTAMPTZ;
ALTER TABLE telao_state ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE telao_state DROP CONSTRAINT IF EXISTS telao_state_cena;
ALTER TABLE telao_state ADD CONSTRAINT telao_state_cena CHECK (
  cena_fixa IS NULL OR cena_fixa IN ('fotos', 'tocando', 'contagem', 'recados', 'advento')
);

ALTER TABLE telao_state DROP CONSTRAINT IF EXISTS telao_state_comando;
ALTER TABLE telao_state ADD CONSTRAINT telao_state_comando CHECK (
  comando IS NULL OR char_length(comando) <= 160
);
