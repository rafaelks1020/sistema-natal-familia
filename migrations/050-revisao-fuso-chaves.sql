-- Revisão de 12/11/2026 (docs/REVISAO-2026-11-12.md). Pode rodar de novo sem efeito.
-- 1) Datas antigas passam a guardar fuso. O banco roda em America/Sao_Paulo e essas colunas eram TIMESTAMP sem fuso
--    gravadas com NOW(), ou seja, hora de São Paulo. Na Vercel (Node em UTC) saíam 3 horas erradas.
--    secret_santa_config.reveal_date fica de fora de propósito: é só o dia da revelação, lido como data.
-- 2) Excluir conta falhava para quem criou missão ou ajuste de pontos, avaliou resposta ou conduziu a Prova.
-- 3) Excluir a pergunta atual do quiz falhava: a chave composta tentava zerar "ano", que é NOT NULL.
-- 4) Álbum: foto de janeiro ou fevereiro do ano seguinte pertence à edição anterior (a da ceia).
BEGIN;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
      FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.data_type = 'timestamp without time zone'
       AND (c.table_name, c.column_name) IN (
         ('app_settings', 'updated_at'), ('auth_attempts', 'criado_em'),
         ('ceia_dishes', 'created_at'), ('ceia_votacoes', 'created_at'), ('ceia_votos', 'created_at'),
         ('content_reports', 'created_at'), ('content_reports', 'resolved_at'),
         ('family_attendance', 'created_at'), ('family_attendance', 'updated_at'),
         ('family_comment_likes', 'created_at'),
         ('family_notifications', 'created_at'), ('family_notifications', 'read_at'),
         ('family_poll_votes', 'created_at'), ('family_polls', 'created_at'),
         ('family_post_comments', 'created_at'), ('family_post_reactions', 'created_at'),
         ('family_posts', 'created_at'), ('family_posts', 'updated_at'),
         ('family_users', 'created_at'), ('family_users', 'terms_accepted_at'),
         ('invites', 'created_at'), ('invites', 'expires_at'), ('invites', 'revoked_at'),
         ('participants', 'paid_date'),
         ('payments', 'checked_at'), ('payments', 'created_at'), ('payments', 'paid_at'),
         ('purchases', 'created_at'),
         ('push_devices', 'created_at'), ('push_devices', 'disabled_at'), ('push_devices', 'last_seen_at'),
         ('secret_santa_config', 'created_at'),
         ('secret_santa_draws', 'created_at'), ('secret_santa_draws', 'revealed_at'),
         ('secret_santa_hint_mutes', 'created_at'),
         ('user_blocks', 'created_at'), ('wish_list', 'created_at')
       )
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''America/Sao_Paulo''',
      r.table_name, r.column_name, r.column_name
    );
  END LOOP;
END $$;

ALTER TABLE gami_ajustes ALTER COLUMN criado_por DROP NOT NULL;
ALTER TABLE karaoke_prova_tentativas ALTER COLUMN controlador_id DROP NOT NULL;

ALTER TABLE gami_ajustes DROP CONSTRAINT IF EXISTS gami_ajustes_criado_por_fkey;
ALTER TABLE gami_ajustes ADD CONSTRAINT gami_ajustes_criado_por_fkey
  FOREIGN KEY (criado_por) REFERENCES family_users(id) ON DELETE SET NULL;

ALTER TABLE gami_missoes DROP CONSTRAINT IF EXISTS gami_missoes_criado_por_fkey;
ALTER TABLE gami_missoes ADD CONSTRAINT gami_missoes_criado_por_fkey
  FOREIGN KEY (criado_por) REFERENCES family_users(id) ON DELETE SET NULL;

ALTER TABLE gami_missoes_respostas DROP CONSTRAINT IF EXISTS gami_missoes_respostas_avaliado_por_fkey;
ALTER TABLE gami_missoes_respostas ADD CONSTRAINT gami_missoes_respostas_avaliado_por_fkey
  FOREIGN KEY (avaliado_por) REFERENCES family_users(id) ON DELETE SET NULL;

ALTER TABLE karaoke_prova_tentativas DROP CONSTRAINT IF EXISTS karaoke_prova_tentativas_controlador_id_fkey;
ALTER TABLE karaoke_prova_tentativas ADD CONSTRAINT karaoke_prova_tentativas_controlador_id_fkey
  FOREIGN KEY (controlador_id) REFERENCES family_users(id) ON DELETE SET NULL;

ALTER TABLE party_quiz_state DROP CONSTRAINT IF EXISTS party_quiz_state_question_id_ano_fkey;
ALTER TABLE party_quiz_state ADD CONSTRAINT party_quiz_state_question_id_ano_fkey
  FOREIGN KEY (question_id, ano) REFERENCES party_quiz_questions(id, ano) ON DELETE SET NULL (question_id);

ALTER TABLE album_photos DROP CONSTRAINT IF EXISTS album_photos_check;
ALTER TABLE album_photos ADD CONSTRAINT album_photos_check CHECK (
  EXTRACT(year FROM taken_on)::integer = ano
  OR (EXTRACT(year FROM taken_on)::integer = ano + 1 AND EXTRACT(month FROM taken_on)::integer <= 2)
);

CREATE INDEX IF NOT EXISTS idx_family_posts_user_id ON family_posts (user_id);

COMMIT;
