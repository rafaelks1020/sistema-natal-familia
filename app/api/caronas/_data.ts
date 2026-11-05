import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import type { CaronasData, Oferta } from './_types';

export async function getCaronas(userId: number): Promise<CaronasData> {
  const ano = edicaoAtual();
  const { rows } = await query<Oferta>(`SELECT o.id, o.ano, o.user_id, u.name, u.avatar_url,
    o.tipo, o.origem, o.quando, o.vagas, o.observacao, o.telefone, o.ativo,
    COALESCE((SELECT r.quantidade FROM ride_reservations r WHERE r.oferta_id = o.id AND r.user_id = $1), 0) AS minha_reserva,
    CASE WHEN o.user_id = $1 THEN COALESCE((SELECT json_agg(json_build_object(
      'user_id', r.user_id, 'name', ru.name, 'quantidade', r.quantidade) ORDER BY r.created_at)
      FROM ride_reservations r JOIN family_users ru ON ru.id = r.user_id
      WHERE r.oferta_id = o.id AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $1 AND b.blocked_id = r.user_id)), '[]'::json)
      ELSE '[]'::json END AS reservas
    FROM ride_offers o JOIN family_users u ON u.id = o.user_id
    WHERE o.ano = $2 AND (o.ativo OR o.user_id = $1)
      AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $1 AND b.blocked_id = o.user_id)
    ORDER BY o.created_at DESC, o.id DESC`, [userId, ano]);
  return { ano, ofertas: rows };
}
