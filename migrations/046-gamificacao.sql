-- Gamificacao do Natal em Familia: configuracao, extrato de pontos, conquistas, ajustes e missoes relampago.
-- Idempotente: pode rodar mais de uma vez. Aplicar apenas pelo orquestrador.

CREATE TABLE IF NOT EXISTS gami_config (
  ano int PRIMARY KEY,
  encerra_em timestamptz NOT NULL,
  ranking_oculto_em timestamptz NOT NULL,
  revelado_em timestamptz,
  missoes_surpresa boolean NOT NULL DEFAULT true,
  recalculado_em timestamptz,
  aviso_24h_em timestamptz,
  aviso_oculto_em timestamptz,
  excluidos int[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gami_config ADD COLUMN IF NOT EXISTS recalculado_em timestamptz;
ALTER TABLE gami_config ADD COLUMN IF NOT EXISTS aviso_24h_em timestamptz;
ALTER TABLE gami_config ADD COLUMN IF NOT EXISTS aviso_oculto_em timestamptz;
ALTER TABLE gami_config ADD COLUMN IF NOT EXISTS excluidos int[] NOT NULL DEFAULT '{}';

ALTER TABLE IF EXISTS album_tags ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS album_photo_likes ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

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

CREATE TABLE IF NOT EXISTS gami_lancamentos (
  id bigserial PRIMARY KEY,
  ano int NOT NULL,
  user_id int NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  origem text NOT NULL CHECK (origem IN ('uso', 'brincadeira', 'karaoke', 'conquista', 'missao', 'ajuste')),
  regra text NOT NULL,
  ref text NOT NULL,
  pontos int NOT NULL,
  descricao text NOT NULL,
  ocorreu_em timestamptz NOT NULL,
  UNIQUE (ano, user_id, regra, ref)
);
CREATE INDEX IF NOT EXISTS gami_lancamentos_ano_user_idx ON gami_lancamentos (ano, user_id);
CREATE INDEX IF NOT EXISTS gami_lancamentos_ano_ocorreu_idx ON gami_lancamentos (ano, ocorreu_em DESC);

CREATE TABLE IF NOT EXISTS gami_conquistas (
  ano int NOT NULL,
  user_id int NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  conquista_id text NOT NULL,
  ganha_em timestamptz NOT NULL DEFAULT now(),
  notificada_em timestamptz,
  PRIMARY KEY (ano, user_id, conquista_id)
);
CREATE INDEX IF NOT EXISTS gami_conquistas_ano_user_idx ON gami_conquistas (ano, user_id);

CREATE TABLE IF NOT EXISTS gami_ajustes (
  id bigserial PRIMARY KEY,
  ano int NOT NULL,
  user_id int NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  pontos int NOT NULL,
  motivo text NOT NULL,
  anula_ref text,
  criado_por int NOT NULL REFERENCES family_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gami_ajustes_ano_idx ON gami_ajustes (ano, created_at DESC);

CREATE TABLE IF NOT EXISTS gami_missoes (
  id bigserial PRIMARY KEY,
  ano int NOT NULL,
  modelo text,
  titulo text NOT NULL,
  descricao text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('foto', 'texto', 'foto_texto')),
  pontos int NOT NULL CHECK (pontos BETWEEN 5 AND 200),
  inicia_em timestamptz NOT NULL,
  termina_em timestamptz NOT NULL,
  aviso_inicio_em timestamptz,
  aviso_fim_em timestamptz,
  criado_por int REFERENCES family_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (termina_em > inicia_em)
);
CREATE INDEX IF NOT EXISTS gami_missoes_ano_inicia_idx ON gami_missoes (ano, inicia_em DESC);

CREATE TABLE IF NOT EXISTS gami_missoes_respostas (
  id bigserial PRIMARY KEY,
  missao_id bigint NOT NULL REFERENCES gami_missoes(id) ON DELETE CASCADE,
  user_id int NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  texto text,
  image_url text,
  status text NOT NULL DEFAULT 'aprovada' CHECK (status IN ('aprovada', 'recusada')),
  motivo_recusa text,
  avaliado_por int REFERENCES family_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (missao_id, user_id)
);
CREATE INDEX IF NOT EXISTS gami_missoes_respostas_missao_idx ON gami_missoes_respostas (missao_id);
