import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { roundMoney } from './_helpers';

/**
 * Quanto a pessoa entra no arrecadado.
 * Pix confirmado (payments PAID) vale a soma gravada em amount.
 * Sem esse Pix, a cota atual só conta se o participante está paid.
 * amount null = não há payment PAID.
 */
export function valorNoArrecadado(
  pixAmount: number | null,
  paid: boolean,
  contributionValue: number,
): number {
  if (pixAmount !== null) return roundMoney(pixAmount);
  if (paid) return roundMoney(contributionValue);
  return 0;
}

/**
 * Arrecadado da edição, fonte única do Início, da Vaquinha, da meta e do painel:
 * Pix confirmados no período da edição mais a cota de quem o organizador marcou como pago sem Pix.
 */
export async function arrecadadoDaEdicao(
  ano: number = edicaoAtual(),
  contributionValue?: number,
): Promise<{ centavos: number; contribuintes: number }> {
  let bruta = contributionValue;
  if (bruta === undefined) {
    const { rows } = await query<{ value: string }>(`SELECT value FROM app_settings WHERE key = 'contribution_value'`);
    bruta = Number(rows[0]?.value);
  }
  const cota = roundMoney(Number.isFinite(bruta) && (bruta as number) >= 0 ? (bruta as number) : 50).toFixed(2);
  const { rows } = await query<{ centavos: string; pessoas: number }>(
    `SELECT COALESCE(ROUND(SUM(
              CASE
                WHEN pix.participant_id IS NOT NULL THEN pix.amount
                WHEN p.paid IS TRUE THEN $1::numeric
                ELSE 0
              END
            ) * 100), 0)::text AS centavos,
            COUNT(*) FILTER (WHERE pix.participant_id IS NOT NULL OR p.paid IS TRUE)::int AS pessoas
       FROM participants p
       LEFT JOIN (
         SELECT participant_id, SUM(amount) AS amount
           FROM payments
          WHERE status = 'PAID' AND created_at >= $2::timestamp AND created_at < $3::timestamp
          GROUP BY participant_id
       ) pix ON pix.participant_id = p.id`,
    [cota, `${ano}-03-01 00:00:00`, `${ano + 1}-03-01 00:00:00`],
  );
  return { centavos: Number(rows[0]?.centavos ?? 0), contribuintes: Number(rows[0]?.pessoas ?? 0) };
}

/** O mesmo valor, em reais. */
export async function fetchArrecadado(contributionValue: number, ano: number = edicaoAtual()): Promise<number> {
  return (await arrecadadoDaEdicao(ano, contributionValue)).centavos / 100;
}
