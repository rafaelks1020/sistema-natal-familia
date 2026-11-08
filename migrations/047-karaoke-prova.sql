-- Prova oficial. Aplicação manual pelo orquestrador.
BEGIN;
CREATE TABLE IF NOT EXISTS karaoke_prova (
  ano INTEGER PRIMARY KEY,
  musicas BIGINT[] NOT NULL CHECK (cardinality(musicas) = 5),
  eliminatoria_ate TIMESTAMPTZ NOT NULL,
  final_em TIMESTAMPTZ NOT NULL,
  final_musica BIGINT REFERENCES karaoke_catalogo(id),
  status TEXT NOT NULL DEFAULT 'preparando' CHECK (status IN ('preparando','eliminatoria','final','encerrada')),
  CHECK (final_em >= eliminatoria_ate),
  CHECK (final_musica IS NULL OR final_musica = ANY(musicas))
);
CREATE TABLE IF NOT EXISTS karaoke_prova_tentativas (
  id BIGSERIAL PRIMARY KEY,
  ano INTEGER NOT NULL REFERENCES karaoke_prova(ano),
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  catalogo_id BIGINT NOT NULL REFERENCES karaoke_catalogo(id),
  fase TEXT NOT NULL CHECK (fase IN ('eliminatoria','final')),
  fila_id BIGINT NOT NULL UNIQUE REFERENCES karaoke_fila(id),
  nota INTEGER CHECK (nota BETWEEN 0 AND 100),
  detalhes JSONB NOT NULL DEFAULT '{}',
  iniciada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  terminada_em TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'cantando' CHECK (status IN ('cantando','valida','abandonada')),
  -- Controle e recuperação de uma TV que perdeu conexão ou foi fechada.
  controlador_id INTEGER NOT NULL REFERENCES family_users(id),
  ultima_atividade_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ano,user_id,catalogo_id,fase)
);
CREATE INDEX IF NOT EXISTS karaoke_prova_em_curso ON karaoke_prova_tentativas (ano,ultima_atividade_em) WHERE status = 'cantando';
-- Registra a cena também no controle remoto do telão.
ALTER TABLE telao_state DROP CONSTRAINT IF EXISTS telao_state_cena;
ALTER TABLE telao_state ADD CONSTRAINT telao_state_cena CHECK (
  cena_fixa IS NULL OR cena_fixa IN ('fotos','tocando','contagem','recados','advento',
    'virada','ceia','linha','lareira','papainoel','brinde','karaoke','revelacao')
);
COMMIT;
