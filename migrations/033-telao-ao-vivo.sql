-- Participação ao vivo no telão: reações de emoji e recados com moderação.
-- Idempotente: pode rodar de novo. Não apaga o que já existe.

CREATE TABLE IF NOT EXISTS telao_reacoes (
  id BIGSERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Coração com seletor de variação (U+2764 U+FE0F), igual ao que a API grava.
ALTER TABLE telao_reacoes DROP CONSTRAINT IF EXISTS telao_reacoes_emoji;
ALTER TABLE telao_reacoes ADD CONSTRAINT telao_reacoes_emoji CHECK (
  emoji IN ('❤️', '😂', '🎄', '🎅', '👏', '🥂', '😍', '🔥')
);

CREATE INDEX IF NOT EXISTS idx_telao_reacoes_ano_created ON telao_reacoes (ano, created_at);
CREATE INDEX IF NOT EXISTS idx_telao_reacoes_user_created ON telao_reacoes (user_id, created_at);

CREATE TABLE IF NOT EXISTS telao_recados_vivo (
  id BIGSERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  moderado_em TIMESTAMPTZ
);

ALTER TABLE telao_recados_vivo DROP CONSTRAINT IF EXISTS telao_recados_vivo_texto;
ALTER TABLE telao_recados_vivo ADD CONSTRAINT telao_recados_vivo_texto CHECK (
  char_length(texto) BETWEEN 1 AND 140
);

ALTER TABLE telao_recados_vivo DROP CONSTRAINT IF EXISTS telao_recados_vivo_status;
ALTER TABLE telao_recados_vivo ADD CONSTRAINT telao_recados_vivo_status CHECK (
  status IN ('pendente', 'aprovado', 'recusado')
);

CREATE INDEX IF NOT EXISTS idx_telao_recados_vivo_fila ON telao_recados_vivo (ano, status, created_at);
CREATE INDEX IF NOT EXISTS idx_telao_recados_vivo_user_created ON telao_recados_vivo (user_id, created_at);
