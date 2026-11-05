-- Caronas, hospedagem e contas da ceia. Aplicação pelo orquestrador.
ALTER TABLE family_users ADD COLUMN IF NOT EXISTS pix_key TEXT;

CREATE TABLE IF NOT EXISTS ride_offers (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('carona_oferta', 'carona_pedido', 'hospedagem_oferta', 'hospedagem_pedido')),
  origem TEXT NOT NULL,
  quando TEXT NOT NULL,
  vagas INTEGER NOT NULL CHECK (vagas >= 0 AND vagas <= 100),
  observacao TEXT NOT NULL,
  telefone TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ride_offers_ano ON ride_offers(ano, ativo, created_at DESC);
CREATE TABLE IF NOT EXISTS ride_reservations (
  ano INTEGER NOT NULL,
  oferta_id INTEGER NOT NULL REFERENCES ride_offers(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0 AND quantidade <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (oferta_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_ride_reservations_user ON ride_reservations(user_id, ano);

CREATE TABLE IF NOT EXISTS ceia_despesas (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0 AND valor_centavos <= 100000000),
  comprovante_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ceia_despesas_ano ON ceia_despesas(ano, created_at DESC);
CREATE TABLE IF NOT EXISTS ceia_despesa_partes (
  ano INTEGER NOT NULL,
  despesa_id INTEGER NOT NULL REFERENCES ceia_despesas(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  PRIMARY KEY (despesa_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_ceia_partes_user ON ceia_despesa_partes(user_id, ano);
CREATE TABLE IF NOT EXISTS ceia_acertos (
  id SERIAL PRIMARY KEY,
  ano INTEGER NOT NULL,
  de_user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  para_user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
  confirmado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (de_user_id <> para_user_id)
);
CREATE INDEX IF NOT EXISTS idx_ceia_acertos_ano ON ceia_acertos(ano, confirmado_em DESC);
