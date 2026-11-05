-- Meta, comprovantes e playlist por edição. Não executada automaticamente.
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS ano INTEGER;
UPDATE purchases SET ano = EXTRACT(YEAR FROM COALESCE(created_at, NOW() AT TIME ZONE 'America/Sao_Paulo'))::int
  - CASE WHEN EXTRACT(MONTH FROM COALESCE(created_at, NOW() AT TIME ZONE 'America/Sao_Paulo')) < 3 THEN 1 ELSE 0 END WHERE ano IS NULL;
ALTER TABLE purchases ALTER COLUMN ano SET NOT NULL;
ALTER TABLE purchases ALTER COLUMN ano SET DEFAULT (
  EXTRACT(YEAR FROM NOW() AT TIME ZONE 'America/Sao_Paulo')::int
  - CASE WHEN EXTRACT(MONTH FROM NOW() AT TIME ZONE 'America/Sao_Paulo') < 3 THEN 1 ELSE 0 END
);
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS value_centavos BIGINT;
UPDATE purchases SET value_centavos = ROUND(value * 100)::bigint WHERE value_centavos IS NULL;
ALTER TABLE purchases ALTER COLUMN value_centavos SET NOT NULL;
-- Mantém a versão publicada compatível entre a migração e a atualização do código.
CREATE OR REPLACE FUNCTION purchases_sincronizar_centavos() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.value_centavos := ROUND(NEW.value * 100)::bigint;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS purchases_centavos ON purchases;
CREATE TRIGGER purchases_centavos BEFORE INSERT OR UPDATE OF value ON purchases
  FOR EACH ROW EXECUTE FUNCTION purchases_sincronizar_centavos();
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS category TEXT;
CREATE INDEX IF NOT EXISTS idx_purchases_ano ON purchases(ano, created_at DESC);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  track_uri TEXT NOT NULL,
  nome TEXT NOT NULL,
  artista TEXT NOT NULL,
  capa_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ano, track_uri)
);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_autor ON playlist_tracks(ano, user_id);
