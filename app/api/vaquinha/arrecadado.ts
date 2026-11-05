import { query } from '@/app/lib/db';
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

/** Uma query só: soma dos Pix PAID mais a cota de quem está paid sem Pix PAID. */
export async function fetchArrecadado(contributionValue: number): Promise<number> {
  const bruta = Number.isFinite(contributionValue) && contributionValue >= 0 ? contributionValue : 50;
  const cota = roundMoney(bruta).toFixed(2);
  const { rows } = await query<{ arrecadado: string | number }>(
    `SELECT COALESCE(SUM(
              CASE
                WHEN pix.participant_id IS NOT NULL THEN pix.amount
                WHEN p.paid IS TRUE THEN $1::numeric
                ELSE 0
              END
            ), 0) AS arrecadado
       FROM participants p
       LEFT JOIN (
         SELECT participant_id, SUM(amount) AS amount
           FROM payments
          WHERE status = 'PAID'
          GROUP BY participant_id
       ) pix ON pix.participant_id = p.id`,
    [cota],
  );
  return roundMoney(Number(rows[0]?.arrecadado ?? 0));
}
