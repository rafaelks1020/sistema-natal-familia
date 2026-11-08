-- Prova do Karaokê: anulação de tentativa pela organização. NÃO aplicada automaticamente: aplicação manual pelo orquestrador.
-- 1) Novo status 'anulada'. 2) A regra "uma tentativa por pessoa, música e fase" passa a valer só para as não anuladas,
-- para a pessoa poder tentar de novo depois de uma anulação.
BEGIN;
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'karaoke_prova_tentativas'::regclass
       AND (contype = 'u' OR (contype = 'c' AND pg_get_constraintdef(oid) LIKE '%cantando%'))
  LOOP
    EXECUTE format('ALTER TABLE karaoke_prova_tentativas DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
ALTER TABLE karaoke_prova_tentativas ADD CONSTRAINT karaoke_prova_tentativas_status_check
  CHECK (status IN ('cantando','valida','abandonada','anulada'));
CREATE UNIQUE INDEX IF NOT EXISTS karaoke_prova_tentativa_unica
  ON karaoke_prova_tentativas (ano,user_id,catalogo_id,fase) WHERE status <> 'anulada';
COMMIT;
