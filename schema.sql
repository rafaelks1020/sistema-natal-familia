-- Schema do banco para Natal em Família 2025
-- Compatível com o código atual (participants, purchases, secret_santa_*, wish_list)

-- Tabela de participantes
CREATE TABLE IF NOT EXISTS participants (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  paid BOOLEAN DEFAULT false,
  paid_date TIMESTAMP
);

-- Tabela de compras
CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  category TEXT,
  brand TEXT,
  color TEXT,
  size TEXT,
  quantity INTEGER DEFAULT 1,
  notes TEXT,
  image_url TEXT,
  -- campo extra usado hoje para múltiplas imagens (armazenando JSON como texto)
  image_urls TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Configuração do sorteio de amigo secreto
CREATE TABLE IF NOT EXISTS secret_santa_config (
  id SERIAL PRIMARY KEY,
  is_active BOOLEAN DEFAULT false,
  min_gift_value DECIMAL(10,2),
  max_gift_value DECIMAL(10,2),
  reveal_date TIMESTAMP,
  -- regras em JSON (como string ou JSON válido)
  rules JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sorteios de amigo secreto (quem tirou quem)
CREATE TABLE IF NOT EXISTS secret_santa_draws (
  id SERIAL PRIMARY KEY,
  config_id INTEGER NOT NULL REFERENCES secret_santa_config(id) ON DELETE CASCADE,
  giver_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  revealed BOOLEAN DEFAULT false,
  revealed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Lista de desejos vinculada ao sorteio ativo
CREATE TABLE IF NOT EXISTS wish_list (
  id SERIAL PRIMARY KEY,
  participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  config_id INTEGER NOT NULL REFERENCES secret_santa_config(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  item_description TEXT,
  item_url TEXT,
  priority INTEGER DEFAULT 1,
  purchased BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Usuários da família para o mural de Natal
CREATE TABLE IF NOT EXISTS family_users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Posts do mural da família
CREATE TABLE IF NOT EXISTS family_posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Reações aos posts do mural (curtidas natalinas)
CREATE TABLE IF NOT EXISTS family_post_reactions (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES family_posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_reaction_per_user UNIQUE (post_id, user_id, reaction_type)
);

-- Comentários nos posts do mural
CREATE TABLE IF NOT EXISTS family_post_comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES family_posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enquetes rápidas do mural
CREATE TABLE IF NOT EXISTS family_polls (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  options TEXT[] NOT NULL,
  created_by INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS family_poll_votes (
  id SERIAL PRIMARY KEY,
  poll_id INTEGER NOT NULL REFERENCES family_polls(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_poll_vote_per_user UNIQUE (poll_id, user_id)
);

-- Presença/RSVP dos participantes
CREATE TABLE IF NOT EXISTS family_attendance (
  id SERIAL PRIMARY KEY,
  participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES family_users(id) ON DELETE SET NULL,
  status TEXT NOT NULL, -- 'yes', 'maybe', 'no'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices auxiliares (opcional, mas ajuda)
CREATE INDEX IF NOT EXISTS idx_participants_paid ON participants(paid);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_secret_santa_config_active ON secret_santa_config(is_active);
CREATE INDEX IF NOT EXISTS idx_wish_list_participant ON wish_list(participant_id);
CREATE INDEX IF NOT EXISTS idx_wish_list_config ON wish_list(config_id);
CREATE INDEX IF NOT EXISTS idx_family_posts_created_at ON family_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_family_post_reactions_post ON family_post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_family_post_comments_post ON family_post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_family_poll_votes_poll ON family_poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_family_attendance_participant ON family_attendance(participant_id);
