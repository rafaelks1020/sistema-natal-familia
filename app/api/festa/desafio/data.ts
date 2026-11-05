import 'server-only';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import type { SessionUser } from '@/app/lib/session';

export interface Challenge { id: number; ano: number; titulo: string; aberto: boolean; encerrado_em: string | null; created_at: string }
export interface Entry { id: number; desafio_id: number; user_id: number; image_url: string; legenda: string; created_at: string; name: string; avatar_url: string | null; votos: number; vencedor: boolean }
export interface ChallengeData { ano: number; me: { id: number; is_admin: boolean }; desafios: Challenge[]; fotos: Entry[]; meusVotos: { desafio_id: number; entry_id: number }[] }

export async function getChallenges(me: SessionUser): Promise<ChallengeData> {
  const ano = edicaoAtual();
  const [challenges, entries, votes] = await Promise.all([
    query<Challenge>(`SELECT id, ano, titulo, aberto, encerrado_em::text, created_at::text FROM party_challenges WHERE ano = $1 ORDER BY aberto DESC, created_at DESC, id DESC`, [ano]),
    query<Entry>(`WITH contagem AS (
        SELECT e.*, (SELECT COUNT(*)::int FROM party_photo_votes v WHERE v.entry_id = e.id) AS votos
          FROM party_photo_entries e WHERE e.ano = $1
      ), resultado AS (
        SELECT e.*, MAX(votos) OVER (PARTITION BY desafio_id) AS maior FROM contagem e
      ) SELECT e.id, e.desafio_id, e.user_id, e.image_url, e.legenda, e.created_at::text,
        u.name, u.avatar_url, e.votos, (NOT c.aberto AND e.votos > 0 AND e.votos = e.maior) AS vencedor
        FROM resultado e JOIN family_users u ON u.id = e.user_id JOIN party_challenges c ON c.id = e.desafio_id
       WHERE NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $2 AND b.blocked_id = e.user_id)
       ORDER BY e.votos DESC, e.created_at, e.id`, [ano, me.id]),
    query<{ desafio_id: number; entry_id: number }>(`SELECT desafio_id, entry_id FROM party_photo_votes WHERE ano = $1 AND user_id = $2`, [ano, me.id]),
  ]);
  return { ano, me: { id: me.id, is_admin: me.is_admin }, desafios: challenges.rows, fotos: entries.rows, meusVotos: votes.rows };
}
