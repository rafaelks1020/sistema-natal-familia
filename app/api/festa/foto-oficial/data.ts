import 'server-only';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import type { SessionUser } from '@/app/lib/session';
export interface OfficialPhoto { id: number; ano: number; image_url: string; legenda: string; dica_pose: string; created_at: string }
export interface OfficialData { ano: number; is_admin: boolean; fotos: OfficialPhoto[] }
export async function getOfficialPhotos(me: SessionUser): Promise<OfficialData> {
  const ano = edicaoAtual();
  const { rows } = await query<OfficialPhoto>(`SELECT id, ano, image_url, legenda, dica_pose, created_at::text FROM family_official_photos p
    WHERE ano <= $1 AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $2 AND b.blocked_id = p.user_id) ORDER BY ano DESC`, [ano, me.id]);
  return { ano, is_admin: me.is_admin, fotos: rows };
}
