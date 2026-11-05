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
