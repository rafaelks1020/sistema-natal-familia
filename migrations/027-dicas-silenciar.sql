-- Quem recebe dicas pode silenciar o amigo oculto sem bloquear a conta (o bloqueio revelaria o nome). Pode executar novamente.
CREATE TABLE IF NOT EXISTS secret_santa_hint_mutes (
  ano INTEGER NOT NULL,
  receiver_participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ano, receiver_participant_id)
);
