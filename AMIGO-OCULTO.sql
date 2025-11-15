-- 🎁 Sistema de Amigo Oculto (Amigo Secreto)

-- Tabela de configuração do sorteio
CREATE TABLE secret_santa_config (
  id SERIAL PRIMARY KEY,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
  is_active BOOLEAN DEFAULT true,
  draw_date TIMESTAMP DEFAULT NOW(),
  reveal_date TIMESTAMP,
  min_gift_value DECIMAL(10,2),
  max_gift_value DECIMAL(10,2),
  rules JSONB, -- Regras customizadas (ex: casais que não podem tirar um ao outro)
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de sorteios (quem tirou quem)
CREATE TABLE secret_santa_draws (
  id SERIAL PRIMARY KEY,
  config_id INTEGER REFERENCES secret_santa_config(id) ON DELETE CASCADE,
  giver_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
  receiver_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL, -- Token único para revelação
  revealed BOOLEAN DEFAULT false,
  revealed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(config_id, giver_id), -- Cada pessoa só tira uma vez por sorteio
  UNIQUE(config_id, receiver_id), -- Cada pessoa só é tirada uma vez por sorteio
  CHECK(giver_id != receiver_id) -- Ninguém pode tirar a si mesmo
);

-- Tabela de lista de desejos
CREATE TABLE wish_list (
  id SERIAL PRIMARY KEY,
  participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
  config_id INTEGER REFERENCES secret_santa_config(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  item_description TEXT,
  item_url TEXT,
  priority INTEGER DEFAULT 1, -- 1=baixa, 2=média, 3=alta
  purchased BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_draws_config ON secret_santa_draws(config_id);
CREATE INDEX idx_draws_giver ON secret_santa_draws(giver_id);
CREATE INDEX idx_draws_receiver ON secret_santa_draws(receiver_id);
CREATE INDEX idx_wishlist_participant ON wish_list(participant_id);
CREATE INDEX idx_wishlist_config ON wish_list(config_id);

-- Comentários
COMMENT ON TABLE secret_santa_config IS 'Configuração de cada sorteio de amigo oculto';
COMMENT ON TABLE secret_santa_draws IS 'Resultado do sorteio - quem tirou quem';
COMMENT ON TABLE wish_list IS 'Lista de desejos de cada participante';
