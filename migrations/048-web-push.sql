-- Web Push: plataforma 'web' e token com o JSON da PushSubscription.
-- O limite antigo de 512 caracteres corta a assinatura do Safari.
-- Idempotente. Não apaga aparelhos já cadastrados. Quem aplica é o orquestrador.

DO $$
DECLARE nome text;
BEGIN
  FOR nome IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'push_devices'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%platform%'
  LOOP
    EXECUTE format('ALTER TABLE push_devices DROP CONSTRAINT %I', nome);
  END LOOP;
END $$;

ALTER TABLE push_devices ADD CONSTRAINT push_devices_platform_check
  CHECK (platform IN ('ios', 'android', 'web'));

DO $$
DECLARE nome text;
BEGIN
  FOR nome IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'push_devices'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%length(token)%'
  LOOP
    EXECUTE format('ALTER TABLE push_devices DROP CONSTRAINT %I', nome);
  END LOOP;
END $$;

ALTER TABLE push_devices ADD CONSTRAINT push_devices_token_check
  CHECK (length(token) BETWEEN 1 AND 4096);

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_devices_web_endpoint
  ON push_devices ((token::jsonb ->> 'endpoint'))
  WHERE platform = 'web';

-- Pessoas fora da competição na gamificação (padrão: conta 'Revisão das Lojas') e timestamps auxiliares do álbum.
ALTER TABLE IF EXISTS gami_config ADD COLUMN IF NOT EXISTS excluidos int[] NOT NULL DEFAULT '{}';
ALTER TABLE IF EXISTS album_tags ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS album_photo_likes ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF to_regclass('public.gami_config') IS NOT NULL AND to_regclass('public.family_users') IS NOT NULL THEN
    INSERT INTO gami_config (ano, encerra_em, ranking_oculto_em, missoes_surpresa, excluidos)
    SELECT
      y.ano,
      make_timestamptz(y.ano, 12, 24, 22, 0, 0, 'America/Sao_Paulo'),
      make_timestamptz(y.ano, 12, 22, 22, 0, 0, 'America/Sao_Paulo'),
      true,
      COALESCE((SELECT ARRAY_AGG(id ORDER BY id) FROM family_users WHERE name = 'Revisão das Lojas'), '{}'::int[])
    FROM (
      SELECT (
        EXTRACT(YEAR FROM NOW() AT TIME ZONE 'America/Sao_Paulo')::int
        - CASE WHEN EXTRACT(MONTH FROM NOW() AT TIME ZONE 'America/Sao_Paulo') < 3 THEN 1 ELSE 0 END
      ) AS ano
    ) y
    ON CONFLICT (ano) DO UPDATE SET
      excluidos = (
        SELECT COALESCE(ARRAY_AGG(DISTINCT x ORDER BY x), '{}'::int[])
          FROM unnest(
            gami_config.excluidos
            || COALESCE((SELECT ARRAY_AGG(id) FROM family_users WHERE name = 'Revisão das Lojas'), '{}'::int[])
          ) AS t(x)
      );

    UPDATE gami_config
       SET excluidos = (
         SELECT COALESCE(ARRAY_AGG(DISTINCT x ORDER BY x), '{}'::int[])
           FROM unnest(
             gami_config.excluidos
             || COALESCE((SELECT ARRAY_AGG(id) FROM family_users WHERE name = 'Revisão das Lojas'), '{}'::int[])
           ) AS t(x)
       )
     WHERE EXISTS (SELECT 1 FROM family_users WHERE name = 'Revisão das Lojas');
  END IF;
END $$;
