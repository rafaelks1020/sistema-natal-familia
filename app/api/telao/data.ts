import 'server-only';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import type { SessionUser } from '@/app/lib/session';
import { parsePostImages } from '@/app/api/posts/_utils';
export interface Slide { key: string; url: string; nome: string; legenda: string; created_at: string; user_id: number | null; source: 'post' | 'compra' | 'desafio'; id: number }
export interface ScreenData { ano: number; fotos: Slide[]; desafio: { id: number; titulo: string } | null; meiaNoite: string; agora: string; meId: number }
interface Row { id: number; source: Slide['source']; user_id: number | null; nome: string; legenda: string; image_url: string; image_urls: string | null; created_at: Date }
export async function getScreen(me: SessionUser): Promise<ScreenData> {
  const ano = edicaoAtual();
  const [photos, challenge, settings] = await Promise.all([
    query<Row>(`SELECT * FROM (
      SELECT p.id, 'post'::text AS source, p.user_id, u.name AS nome, p.content AS legenda, p.image_url, p.image_urls,
        p.created_at::timestamptz AS created_at
      FROM family_posts p JOIN family_users u ON u.id = p.user_id
      WHERE p.created_at >= $1::timestamp AND p.created_at < $2::timestamp
        AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $4 AND b.blocked_id = p.user_id)
      UNION ALL
      SELECT p.id, 'compra', NULL::int, 'Vaquinha da família', p.description, p.image_url, p.image_urls,
        p.created_at::timestamptz FROM purchases p WHERE p.ano = $3
      UNION ALL
      SELECT e.id, 'desafio', e.user_id, u.name, e.legenda, e.image_url, NULL::text, e.created_at::timestamptz
      FROM party_photo_entries e JOIN family_users u ON u.id = e.user_id WHERE e.ano = $3
        AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $4 AND b.blocked_id = e.user_id)
      ) fotos WHERE NULLIF(image_url, '') IS NOT NULL OR (NULLIF(image_urls, '') IS NOT NULL AND image_urls <> '[]')
      ORDER BY created_at DESC, id DESC LIMIT 80`,
    [`${ano}-03-01`, `${ano + 1}-03-01`, ano, me.id]),
    query<{ id: number; titulo: string }>('SELECT id, titulo FROM party_challenges WHERE ano = $1 AND aberto LIMIT 1', [ano]),
    query<{ value: string }>("SELECT value FROM app_settings WHERE key = 'event_date'"),
  ]);
  const fotos = photos.rows.flatMap((row) => parsePostImages(row.image_urls, row.image_url).map((url, i) => ({
    key: `${row.source}-${row.id}-${i}-${new Date(row.created_at).toISOString()}`, url, nome: row.nome, legenda: row.legenda ?? '', created_at: new Date(row.created_at).toISOString(), user_id: row.user_id, source: row.source, id: row.id,
  })));
  const agora = new Date();
  const limite = agora.getTime() - 10 * 60 * 1000;
  fotos.sort((a, b) => {
    const ta = Date.parse(a.created_at), tb = Date.parse(b.created_at);
    return Number(tb >= limite) - Number(ta >= limite) || tb - ta || a.key.localeCompare(b.key);
  });
  const event = settings.rows[0]?.value;
  const valid = event && !Number.isNaN(Date.parse(event)) ? new Date(event) : new Date(`${ano}-12-24T20:00:00-03:00`);
  const dia = valid.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const meiaNoite = new Date(new Date(`${dia}T00:00:00-03:00`).getTime() + 86400000).toISOString();
  return { ano, fotos, desafio: challenge.rows[0] ?? null, meiaNoite, agora: agora.toISOString(), meId: me.id };
}
