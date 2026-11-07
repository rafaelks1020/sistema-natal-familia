-- Progresso do estúdio. Aplicar antes de reiniciar o worker atualizado.
ALTER TABLE karaoke_catalogo
  ADD COLUMN IF NOT EXISTS etapa TEXT NOT NULL DEFAULT 'na_fila',
  ADD COLUMN IF NOT EXISTS progresso SMALLINT NOT NULL DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS etapa_em TIMESTAMPTZ NOT NULL DEFAULT now();

-- Compatibilidade com pedidos existentes. Reaplicar não apaga etapas detalhadas.
UPDATE karaoke_catalogo SET
  etapa = CASE status WHEN 'processando' THEN 'separando_voz' ELSE status END,
  progresso = CASE status WHEN 'pronta' THEN 100 WHEN 'baixando' THEN 5 WHEN 'processando' THEN 15 ELSE 0 END,
  etapa_em = atualizado_em
WHERE etapa = 'na_fila' AND status <> 'na_fila';

-- Somente etapas concluídas com sucesso alimentam a média. Voltas à fila,
-- falhas e reinícios não geram amostras para a etapa interrompida.
CREATE TABLE IF NOT EXISTS karaoke_processamento_etapas (
  id BIGSERIAL PRIMARY KEY,
  catalogo_id BIGINT NOT NULL REFERENCES karaoke_catalogo(id) ON DELETE CASCADE,
  etapa TEXT NOT NULL CHECK (etapa IN ('baixando', 'separando_voz', 'alinhando_letra', 'gerando_notas', 'publicando')),
  duracao_s DOUBLE PRECISION NOT NULL CHECK (duracao_s >= 0),
  finalizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS karaoke_processamento_etapas_media
  ON karaoke_processamento_etapas (etapa, finalizado_em DESC, id DESC);

-- A posição é calculada na API pela mesma ordem usada pelo worker: created_at, id.
