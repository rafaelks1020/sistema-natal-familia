-- Álbum separado do mural. Aplicar pelo orquestrador, nunca pela aplicação.
ALTER TABLE family_posts ADD COLUMN IF NOT EXISTS ano INTEGER;
UPDATE family_posts SET ano = EXTRACT(YEAR FROM COALESCE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', NOW() AT TIME ZONE 'America/Sao_Paulo'))::int
  - CASE WHEN EXTRACT(MONTH FROM COALESCE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', NOW() AT TIME ZONE 'America/Sao_Paulo')) < 3 THEN 1 ELSE 0 END
WHERE ano IS NULL;
ALTER TABLE family_posts ALTER COLUMN ano SET NOT NULL;
ALTER TABLE family_posts ALTER COLUMN ano SET DEFAULT (
  EXTRACT(YEAR FROM NOW() AT TIME ZONE 'America/Sao_Paulo')::int
  - CASE WHEN EXTRACT(MONTH FROM NOW() AT TIME ZONE 'America/Sao_Paulo') < 3 THEN 1 ELSE 0 END
);
CREATE INDEX IF NOT EXISTS family_posts_album_ano ON family_posts(ano, created_at DESC);

CREATE TABLE IF NOT EXISTS album_photos (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '' CHECK (length(caption) <= 500),
  taken_on DATE NOT NULL,
  client_key TEXT NOT NULL CHECK (length(client_key) BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (EXTRACT(YEAR FROM taken_on)::int = ano),
  UNIQUE(user_id, client_key)
);
CREATE INDEX IF NOT EXISTS album_photos_ano_data ON album_photos(ano, taken_on DESC, id DESC);
CREATE TABLE IF NOT EXISTS album_tags (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  photo_key TEXT NOT NULL,
  image_url TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  person_source TEXT NOT NULL CHECK (person_source IN ('user', 'tree')),
  person_id INTEGER NOT NULL CHECK (person_id > 0),
  UNIQUE(photo_key, person_source, person_id)
);
CREATE INDEX IF NOT EXISTS album_tags_pessoa ON album_tags(person_source, person_id, ano);
CREATE TABLE IF NOT EXISTS album_photo_likes (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  photo_id INTEGER NOT NULL REFERENCES album_photos(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  UNIQUE(photo_id, user_id)
);
CREATE TABLE IF NOT EXISTS album_photo_reports (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  photo_id INTEGER NOT NULL REFERENCES album_photos(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  motivo TEXT NOT NULL CHECK (length(motivo) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS album_reports_pending ON album_photo_reports(created_at) WHERE resolved_at IS NULL;

-- Tolera o JSON legado e mantém os índices das imagens estáveis para as marcações.
CREATE OR REPLACE FUNCTION album_urls(multiple TEXT, single_url TEXT) RETURNS TEXT[]
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE urls TEXT[] := ARRAY[]::text[]; item JSONB; url TEXT;
BEGIN
  BEGIN
    IF jsonb_typeof(multiple::jsonb) = 'array' THEN
      FOR item IN SELECT value FROM jsonb_array_elements(multiple::jsonb) LOOP
        IF jsonb_typeof(item) = 'string' THEN
          url := btrim(item #>> '{}');
          IF url ~ '^https://[a-zA-Z0-9.-]+[.]public[.]blob[.]vercel-storage[.]com/' AND NOT url = ANY(urls) THEN
            urls := array_append(urls, url);
          END IF;
        END IF;
      END LOOP;
    END IF;
  EXCEPTION WHEN invalid_text_representation THEN urls := ARRAY[]::text[];
  END;
  url := btrim(single_url);
  IF url ~ '^https://[a-zA-Z0-9.-]+[.]public[.]blob[.]vercel-storage[.]com/' AND NOT url = ANY(urls) THEN
    urls := array_prepend(url, urls);
  END IF;
  RETURN urls;
END $$;
