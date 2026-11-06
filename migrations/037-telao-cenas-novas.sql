-- Telão: libera as cenas novas para o controle fixar (virada, ceia, linha do tempo, lareira, Papai Noel, brinde, karaokê).
ALTER TABLE telao_state DROP CONSTRAINT IF EXISTS telao_state_cena;
ALTER TABLE telao_state ADD CONSTRAINT telao_state_cena CHECK (
  cena_fixa IS NULL OR cena_fixa IN ('fotos', 'tocando', 'contagem', 'recados', 'advento',
    'virada', 'ceia', 'linha', 'lareira', 'papainoel', 'brinde', 'karaoke')
);
