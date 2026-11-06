import { query } from '@/app/lib/db';
import { num } from './formato';

/** Janela da edição, igual à meta da vaquinha: 1º de março até 1º de março do ano seguinte. */
export function janelaEdicao(ano: number): { inicio: string; fim: string } {
  return { inicio: `${ano}-03-01 00:00:00`, fim: `${ano + 1}-03-01 00:00:00` };
}

export type NumerosVaquinha = {
  arrecadado_centavos: number;
  gasto_centavos: number;
  saldo_centavos: number;
  meta_centavos: number;
  pagaram: number;
  participantes: number;
};

/**
 * Arrecadado: soma dos Pix pagos na janela da edição (a mesma conta da meta na vaquinha).
 * Quem pagou: flag manual ou Pix pago nessa janela.
 * Gasto: compras lançadas na edição.
 */
export async function numerosVaquinha(ano: number): Promise<NumerosVaquinha> {
  const { inicio, fim } = janelaEdicao(ano);
  const [settings, pagos, pessoas, gastos] = await Promise.all([
    query<{ key: string; value: string }>(
      `SELECT key, value FROM app_settings WHERE key = ANY($1::text[])`,
      [['vaquinha_meta_centavos', 'vaquinha_ano']],
    ),
    query<{ centavos: string }>(
      `SELECT COALESCE(ROUND(SUM(amount) * 100), 0)::text AS centavos
         FROM payments
        WHERE status = 'PAID' AND created_at >= $1::timestamp AND created_at < $2::timestamp`,
      [inicio, fim],
    ),
    query<{ participantes: number; pagaram: number }>(
      `SELECT COUNT(*)::int AS participantes,
              COUNT(*) FILTER (
                WHERE paid IS TRUE OR EXISTS (
                  SELECT 1 FROM payments y
                   WHERE y.participant_id = participants.id
                     AND y.status = 'PAID'
                     AND y.created_at >= $1::timestamp
                     AND y.created_at < $2::timestamp
                )
              )::int AS pagaram
         FROM participants`,
      [inicio, fim],
    ),
    query<{ centavos: string }>(
      `SELECT COALESCE(SUM(value_centavos), 0)::text AS centavos FROM purchases WHERE ano = $1`,
      [ano],
    ),
  ]);
  const config = Object.fromEntries(settings.rows.map((r) => [r.key, r.value]));
  const meta = Number(config.vaquinha_ano) === ano ? Math.max(0, Math.trunc(num(config.vaquinha_meta_centavos))) : 0;
  const arrecadado = Math.max(0, Math.round(num(pagos.rows[0]?.centavos)));
  const gasto = Math.max(0, Math.round(num(gastos.rows[0]?.centavos)));
  return {
    arrecadado_centavos: arrecadado,
    gasto_centavos: gasto,
    saldo_centavos: arrecadado - gasto,
    meta_centavos: meta,
    pagaram: pessoas.rows[0]?.pagaram ?? 0,
    participantes: pessoas.rows[0]?.participantes ?? 0,
  };
}
