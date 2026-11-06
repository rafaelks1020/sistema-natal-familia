-- Jogos novos da noite de Natal em tela grande: Mímica/Desenho, Quem é o bebê?, Roleta de prendas e Batalha de times.
-- Idempotente: pode rodar de novo. Não mexe em telao_state: o jogo em destaque fica em party_jogo_ativo.

-- Times da noite (placar acumulado). Ids de time ficam estáveis enquanto o ano durar.
CREATE TABLE IF NOT EXISTS party_teams (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  nome TEXT NOT NULL CHECK (char_length(nome) BETWEEN 1 AND 40),
  cor TEXT NOT NULL DEFAULT '#C5292D',
  pontos INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, ano)
);
CREATE INDEX IF NOT EXISTS party_teams_ano ON party_teams (ano, id);

-- Cada pessoa está em um único time por ano.
CREATE TABLE IF NOT EXISTS party_team_members (
  ano INTEGER NOT NULL,
  team_id INTEGER NOT NULL REFERENCES party_teams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  PRIMARY KEY (ano, user_id)
);
CREATE INDEX IF NOT EXISTS party_team_members_time ON party_team_members (team_id);

-- Mímica / Desenho. A palavra só sai do servidor para quem joga (nunca para o telão).
CREATE TABLE IF NOT EXISTS party_mimica (
  id BIGSERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  palavra TEXT NOT NULL,
  modo TEXT NOT NULL DEFAULT 'mimica' CHECK (modo IN ('mimica', 'desenho')),
  quem_joga INTEGER REFERENCES family_users(id) ON DELETE SET NULL,
  team_id INTEGER REFERENCES party_teams(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'jogando' CHECK (status IN ('jogando', 'acertou', 'tempo')),
  inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duracao_s INTEGER NOT NULL DEFAULT 60 CHECK (duracao_s BETWEEN 10 AND 600),
  encerrado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS party_mimica_ano ON party_mimica (ano, id DESC);

-- Quem é o bebê? Foto antiga de alguém da família; todos palpitam.
CREATE TABLE IF NOT EXISTS party_bebe (
  id BIGSERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  foto_url TEXT NOT NULL,
  resposta_user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'revelada')),
  revelada_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS party_bebe_ano ON party_bebe (ano, id DESC);

CREATE TABLE IF NOT EXISTS party_bebe_votos (
  bebe_id BIGINT NOT NULL REFERENCES party_bebe(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  palpite_user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bebe_id, user_id)
);

-- Roleta de prendas. itens = lista de prendas do sorteio; participantes = ids que estavam na roda no giro.
CREATE TABLE IF NOT EXISTS party_roleta (
  id BIGSERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  itens JSONB NOT NULL DEFAULT '[]'::jsonb,
  participantes JSONB,
  sorteado_user_id INTEGER REFERENCES family_users(id) ON DELETE SET NULL,
  prenda TEXT,
  girado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS party_roleta_ano ON party_roleta (ano, id DESC);

-- Qual desses jogos está em destaque no telão (um por ano). ref_id aponta para a linha do jogo.
CREATE TABLE IF NOT EXISTS party_jogo_ativo (
  ano INTEGER PRIMARY KEY,
  jogo TEXT NOT NULL CHECK (jogo IN ('mimica', 'bebe', 'roleta', 'times')),
  ref_id BIGINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
