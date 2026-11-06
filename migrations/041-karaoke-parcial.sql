-- Karaokê: placar parcial (0 a 10000) da música que está cantando, enviado pelo telão a cada poucos segundos.
-- Idempotente: pode rodar de novo.

ALTER TABLE karaoke_fila ADD COLUMN IF NOT EXISTS parcial INTEGER NULL;
