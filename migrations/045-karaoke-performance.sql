-- Karaokê: vídeo da apresentação inteira (câmera, música e voz) em cada música da fila.
-- Idempotente: pode rodar de novo.

ALTER TABLE karaoke_fila ADD COLUMN IF NOT EXISTS video_url TEXT NULL;
