-- Notificação com pontos surpresa: o admin dispara um push e quem TOCAR nele ganha pontos extras no Campeão do Natal.
-- O código secreto só viaja dentro do push (rota /bonus/<codigo>). Idempotente. Quem aplica é o orquestrador.

CREATE TABLE IF NOT EXISTS push_bonus (
  id serial PRIMARY KEY,
  codigo text UNIQUE NOT NULL,
  titulo text,
  corpo text,
  pontos int NOT NULL CHECK (pontos BETWEEN 1 AND 1000),
  criado_por int REFERENCES family_users(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  enviado_em timestamptz,
  expira_em timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS push_bonus_resgates (
  bonus_id int NOT NULL REFERENCES push_bonus(id) ON DELETE CASCADE,
  user_id int NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  resgatado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bonus_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_push_bonus_resgates_user ON push_bonus_resgates (user_id);
