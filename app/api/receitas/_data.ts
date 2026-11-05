import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
export interface Entry {
  id: number; ano: number; user_id: number; titulo: string; de_quem: string;
  foto_url: string | null; audio_url: string | null; created_at: string;
  author_name: string; avatar_url: string | null; categoria: string; ingredientes: string; modo_preparo: string; segredo: string | null; updated_at: string;
}
export async function carregar(userId: number, id?: number) {
  const result = await query<Entry>(`SELECT c.*, u.name AS author_name, u.avatar_url
    FROM family_recipes c JOIN family_users u ON u.id = c.user_id
    WHERE c.ano = $1 AND ($3::integer IS NULL OR c.id = $3)
    AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $2 AND b.blocked_id = c.user_id)
    ORDER BY c.created_at DESC, c.id DESC`, [edicaoAtual(), userId, id ?? null]);
  return result.rows;
}
