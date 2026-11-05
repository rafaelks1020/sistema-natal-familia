import { enviarPush } from './push';
import { query, transaction } from './db';
import { consultarBoleto, diaSP, listarPagos } from './c6';

// Regras do pagamento da vaquinha:
// - Pagamento confirmado SÓ depois de consultar o C6 (status PAID e valor igual ao cobrado).
// - Ao confirmar, o participante fica pago (paid = true) na mesma transação.

export interface PaymentRow {
  id: number;
  participant_id: number;
  reference: string;
  amount: string;
  status: string;
  pix_copia_cola: string | null;
  linha_digitavel: string | null;
  due_date: string | null;
  created_at: string;
  checked_at: string | null;
  paid_at: string | null;
}

export const FINAIS = new Set(['PAID', 'CANCELED', 'CANCELLED', 'EXPIRED']);

async function marcarPago(ref: string, valorPago: number | null): Promise<boolean> {
  let notifyUserId: number | null = null;
  const paid = await transaction(async (q) => {
    const { rows } = await q<PaymentRow>('SELECT * FROM payments WHERE reference = $1 FOR UPDATE', [ref]);
    const p = rows[0];
    if (!p) {
      console.error(`[pagamentos] ${ref}: referência não encontrada`);
      return false;
    }
    if (p.status === 'PAID') return false;
    // Só baixa com o valor confirmado pelo banco e igual ao cobrado.
    if (valorPago == null || Math.abs(valorPago - Number(p.amount)) > 0.01) {
      console.error(`[pagamentos] ${ref}: valor pago ausente ou diferente do cobrado`);
      return false;
    }
    await q(`UPDATE payments SET status = 'PAID', paid_at = NOW(), checked_at = NOW() WHERE id = $1`, [p.id]);
    const participant = await q<{ user_id: number | null }>(
      `UPDATE participants SET paid = true, paid_date = COALESCE(paid_date, NOW()) WHERE id = $1 RETURNING user_id`,
      [p.participant_id],
    );
    notifyUserId = participant.rows[0]?.user_id ?? null;
    return true;
  });
  if (paid && notifyUserId !== null) {
    void enviarPush([notifyUserId], {
      titulo: 'Pagamento confirmado', corpo: 'Pix confirmado. Obrigado pela contribuição!', rota: '/vaquinha',
    });
  }
  return paid;
}

/** Consulta o C6 e atualiza um pagamento em aberto. Devolve a linha atualizada. */
export async function atualizarPagamento(p: PaymentRow): Promise<PaymentRow> {
  if (FINAIS.has(p.status)) return p;
  const boleto = await consultarBoleto(p.reference);
  if (boleto.status === 'PAID') {
    await marcarPago(p.reference, boleto.valor);
  } else {
    // Nunca rebaixa um PAID (outra aba ou o cron podem ter baixado no meio).
    // SUBSTITUIDO (a pessoa trocou o valor) continua sendo conferido, mas não volta a "aberto".
    await query(
      `UPDATE payments SET status = CASE WHEN status = 'SUBSTITUIDO' AND $2 NOT IN ('PAID','CANCELED','CANCELLED','EXPIRED') THEN status ELSE $2 END, checked_at = NOW()
        WHERE id = $1 AND status <> 'PAID'`,
      [p.id, boleto.status],
    );
  }
  const { rows } = await query<PaymentRow>('SELECT * FROM payments WHERE id = $1', [p.id]);
  return rows[0];
}

/** Rede de segurança: boletos NF pagos nos últimos 3 dias que ainda não foram baixados aqui. */
export async function conciliar(): Promise<{ verificados: number; baixados: number }> {
  const pagos = (await listarPagos(diaSP(-3), diaSP(0))).filter((b) => b.referencia.startsWith('NF'));
  let baixados = 0;
  for (const b of pagos) {
    if (await marcarPago(b.referencia, b.valor)) baixados++;
  }
  // Também revisa os abertos com mais de 10 min sem consulta (até 20 por rodada).
  const { rows } = await query<PaymentRow>(
    `SELECT * FROM payments
      WHERE status NOT IN ('PAID','CANCELED','CANCELLED','EXPIRED')
        AND (checked_at IS NULL OR checked_at < NOW() - INTERVAL '10 minutes')
      ORDER BY created_at DESC LIMIT 20`,
  );
  for (const p of rows) {
    const antes = p.status;
    const depois = await atualizarPagamento(p).catch(() => p);
    if (antes !== 'PAID' && depois.status === 'PAID') baixados++;
  }
  return { verificados: pagos.length + rows.length, baixados };
}
