-- Árvore genealógica e homenagens permanentes entre edições. Pode executar novamente.

UPDATE family_tree_people p
SET user_id = NULL
WHERE user_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM family_tree_people p2
    WHERE p2.user_id = p.user_id AND p2.id < p.id
  );

DROP INDEX IF EXISTS family_tree_people_conta;
CREATE UNIQUE INDEX IF NOT EXISTS family_tree_people_conta
  ON family_tree_people (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS family_tree_people_nome
  ON family_tree_people (nome, id);

CREATE UNIQUE INDEX IF NOT EXISTS family_tree_links_par_tipo
  ON family_tree_links (pessoa_id, parente_id, tipo);

CREATE INDEX IF NOT EXISTS family_memorials_created
  ON family_memorials (created_at DESC, id DESC);
