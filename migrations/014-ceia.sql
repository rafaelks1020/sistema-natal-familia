-- Ceia da edição: presença com acompanhantes, quem leva o quê e votação.
-- Pode executar novamente. ano nulo em family_attendance é confirmação antiga e segue valendo até a pessoa responder de novo.

ALTER TABLE family_attendance ADD COLUMN IF NOT EXISTS ano INTEGER;
ALTER TABLE family_attendance ADD COLUMN IF NOT EXISTS adultos INTEGER;
ALTER TABLE family_attendance ADD COLUMN IF NOT EXISTS criancas INTEGER;
ALTER TABLE family_attendance ADD COLUMN IF NOT EXISTS restricao TEXT;

CREATE INDEX IF NOT EXISTS idx_family_attendance_ano ON family_attendance (ano);

CREATE TABLE IF NOT EXISTS ceia_dishes (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  responsavel_id INTEGER REFERENCES family_users(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  quantidade TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT ceia_dishes_categoria CHECK (categoria IN ('salgado', 'doce', 'bebida', 'descartavel', 'outro')),
  CONSTRAINT ceia_dishes_nome CHECK (char_length(btrim(nome)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_ceia_dishes_ano ON ceia_dishes (ano, categoria);

CREATE TABLE IF NOT EXISTS ceia_votacoes (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  pergunta TEXT NOT NULL,
  tipo TEXT NOT NULL,
  aberta BOOLEAN NOT NULL DEFAULT TRUE,
  criado_por INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT ceia_votacoes_tipo CHECK (tipo IN ('local', 'cardapio', 'data', 'outro')),
  CONSTRAINT ceia_votacoes_pergunta CHECK (char_length(btrim(pergunta)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_ceia_votacoes_ano ON ceia_votacoes (ano, aberta);

CREATE TABLE IF NOT EXISTS ceia_votacao_opcoes (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  votacao_id INTEGER NOT NULL REFERENCES ceia_votacoes(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT ceia_votacao_opcoes_texto CHECK (char_length(btrim(texto)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_ceia_votacao_opcoes_votacao ON ceia_votacao_opcoes (votacao_id, ordem);

CREATE TABLE IF NOT EXISTS ceia_votos (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  votacao_id INTEGER NOT NULL REFERENCES ceia_votacoes(id) ON DELETE CASCADE,
  opcao_id INTEGER NOT NULL REFERENCES ceia_votacao_opcoes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT ceia_votos_um_por_pessoa UNIQUE (votacao_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ceia_votos_opcao ON ceia_votos (opcao_id);
