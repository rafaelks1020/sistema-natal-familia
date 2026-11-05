import { query } from '@/app/lib/db';
import { ok, route } from '@/app/lib/api';
import { motivoInvalido, SQL_VENCIDO } from '@/app/lib/convites';

// GET /api/invites/check?t=<token> (público) -> { valid, label, participant_name } ou { valid:false, reason }.
// Não revela nada além do nome do convite: o token tem 24 caracteres aleatórios.
export const GET = route(async (req) => {
  const token = new URL(req.url).searchParams.get('t')?.trim() ?? '';
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return ok({ valid: false, reason: 'Convite inválido.' });
  const { rows } = await query(
    `SELECT i.label, i.max_uses, i.uses, i.revoked_at, ${SQL_VENCIDO.replace(/expires_at/g, 'i.expires_at')},
            p.name AS participant_name
       FROM invites i LEFT JOIN participants p ON p.id = i.participant_id AND p.user_id IS NULL
      WHERE i.token = $1`,
    [token],
  );
  const c = rows[0];
  if (!c) return ok({ valid: false, reason: 'Convite inválido.' });
  const motivo = motivoInvalido(c);
  if (motivo) return ok({ valid: false, reason: motivo });
  return ok({ valid: true, label: c.label, participant_name: c.participant_name ?? null });
});
