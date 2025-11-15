-- 🔄 Migração: Adicionar campo TOKEN à tabela existente
-- Execute este SQL se você já criou a tabela secret_santa_draws SEM o campo token

-- Adicionar coluna token (se não existir)
ALTER TABLE secret_santa_draws 
ADD COLUMN IF NOT EXISTS token TEXT;

-- Criar índice único para o token
CREATE UNIQUE INDEX IF NOT EXISTS secret_santa_draws_token_key ON secret_santa_draws(token);

-- Gerar tokens para registros existentes (se houver)
-- Nota: Você precisará executar este UPDATE manualmente se já tiver dados
-- UPDATE secret_santa_draws 
-- SET token = UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8))
-- WHERE token IS NULL;

-- Tornar o campo obrigatório (após gerar tokens para registros existentes)
-- ALTER TABLE secret_santa_draws 
-- ALTER COLUMN token SET NOT NULL;

-- ✅ Pronto! Agora a tabela está atualizada com o campo token
