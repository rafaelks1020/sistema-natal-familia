-- Pagamento da vaquinha pelo C6 (BolePIX na conta da SpeedTech). Idempotente.

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES family_users(id) ON DELETE SET NULL,
  reference TEXT NOT NULL UNIQUE,          -- external_reference_id do C6 (26 [A-Z0-9], prefixo NF)
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'CREATED',  -- status do C6: CREATED, REGISTERED, PAID, CANCELED, EXPIRED
  pix_copia_cola TEXT,
  linha_digitavel TEXT,
  due_date DATE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  checked_at TIMESTAMP,
  paid_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payments_participant ON payments(participant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_open ON payments(status) WHERE status NOT IN ('PAID', 'CANCELED', 'EXPIRED');

-- Dados de cobrança guardados para o próximo pagamento (o C6 exige CPF e endereço do pagador).
ALTER TABLE family_users ADD COLUMN IF NOT EXISTS billing_cpf TEXT;
ALTER TABLE family_users ADD COLUMN IF NOT EXISTS billing_address JSONB;
