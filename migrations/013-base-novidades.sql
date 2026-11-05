-- Base das novidades: denúncia de qualquer conteúdo novo (regra 1.2 da Apple). Pode executar novamente.
ALTER TABLE content_reports ADD COLUMN IF NOT EXISTS alvo_tipo TEXT;
ALTER TABLE content_reports ADD COLUMN IF NOT EXISTS alvo_id INTEGER;
ALTER TABLE content_reports ADD COLUMN IF NOT EXISTS autor_id INTEGER REFERENCES family_users(id) ON DELETE CASCADE;
ALTER TABLE content_reports ADD COLUMN IF NOT EXISTS trecho TEXT;
ALTER TABLE content_reports DROP CONSTRAINT IF EXISTS content_reports_check;
ALTER TABLE content_reports DROP CONSTRAINT IF EXISTS content_reports_um_alvo;
ALTER TABLE content_reports ADD CONSTRAINT content_reports_um_alvo CHECK (
  (post_id IS NOT NULL)::int + (comment_id IS NOT NULL)::int + (alvo_tipo IS NOT NULL AND alvo_id IS NOT NULL)::int = 1
);
