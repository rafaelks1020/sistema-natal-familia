import { randomBytes } from 'crypto';

// Regras dos convites por link (usadas pelo cadastro e pelas rotas /api/invites).

export interface InviteRow {
  id: number;
  token: string;
  label: string;
  participant_id: number | null;
  max_uses: number | null;
  uses: number;
  expires_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}

export function novoToken(): string {
  return randomBytes(18).toString('base64url'); // 24 caracteres, impossível de adivinhar
}

/** Colunas extras para a checagem: o vencimento é calculado no banco (sem confusão de fuso). */
export const SQL_VENCIDO = `(expires_at IS NOT NULL AND expires_at < NOW()) AS vencido`;

/** Motivo de o convite não valer mais, ou null se ainda vale. */
export function motivoInvalido(
  c: Pick<InviteRow, 'revoked_at' | 'max_uses' | 'uses'> & { vencido: boolean },
): string | null {
  if (c.revoked_at) return 'Este convite foi cancelado.';
  if (c.vencido) return 'Este convite venceu.';
  if (c.max_uses != null && c.uses >= c.max_uses) return 'Este convite já foi usado.';
  return null;
}

export interface PedidoConvite {
  id: number;
  nome: string;
  parentesco: string;
  user_id: number;
  solicitante: string;
  status: 'pendente' | 'aprovado' | 'recusado';
  token: string | null;
  link_ativo: boolean;
}

export async function carregarPedidos(me: { id: number; is_admin: boolean }): Promise<PedidoConvite[]> {
  const { query } = await import('./db');
  const { edicaoAtual } = await import('./edicao');
  const { rows: tables } = await query<{ existe: string | null }>("SELECT to_regclass('public.user_blocks')::text AS existe");
  const bloqueio = tables[0]?.existe
    ? 'AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $2 AND b.blocked_id = r.user_id)'
    : '';
  const { rows } = await query<PedidoConvite>(
    `SELECT r.id, r.nome, r.parentesco, r.user_id, u.name AS solicitante, r.status,
            i.token, (i.id IS NOT NULL AND i.revoked_at IS NULL AND (i.expires_at IS NULL OR i.expires_at >= NOW())
              AND (i.max_uses IS NULL OR i.uses < i.max_uses)) AS link_ativo
       FROM invitation_requests r JOIN family_users u ON u.id = r.user_id
       LEFT JOIN invites i ON i.id = r.invite_id
      WHERE r.ano = $1 AND ($3::boolean OR r.user_id = $2) ${bloqueio}
      ORDER BY (r.status = 'pendente') DESC, r.created_at DESC, r.id DESC`,
    [edicaoAtual(), me.id, me.is_admin],
  );
  return rows;
}

export async function carregarConvites() {
  const { query } = await import('./db');
  const { rows } = await query(
    `SELECT i.id, i.token, i.label, i.participant_id, p.name AS participant_name, i.max_uses, i.uses,
            i.created_at, i.revoked_at,
            CASE WHEN i.expires_at IS NULL THEN NULL
                 ELSE GREATEST(0, ceil(extract(epoch FROM (i.expires_at - NOW())) / 86400))::int END AS days_left,
            ${SQL_VENCIDO.replace(/expires_at/g, 'i.expires_at')},
            COALESCE((SELECT json_agg(u.name ORDER BY u.created_at) FROM family_users u WHERE u.invite_id = i.id), '[]') AS joined
       FROM invites i
       LEFT JOIN participants p ON p.id = i.participant_id
      ORDER BY i.revoked_at IS NOT NULL, i.created_at DESC
      LIMIT 100`,
  );
  return rows.map((r) => ({
      id: r.id,
      token: r.token,
      label: r.label,
      participant_id: r.participant_id,
      participant_name: r.participant_name,
      max_uses: r.max_uses,
      uses: r.uses,
      days_left: r.days_left,
      created_at: r.created_at,
      joined: r.joined,
      status: (motivoInvalido(r) ? (r.revoked_at ? 'cancelado' : r.vencido ? 'vencido' : 'usado') : 'ativo') as 'cancelado' | 'vencido' | 'usado' | 'ativo',
    }));
}
