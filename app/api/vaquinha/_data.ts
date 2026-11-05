import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { consultarMeta } from './meta';
import {
  parseImages,
  roundMoney,
  VaquinhaParticipant,
  VaquinhaPurchase,
  VaquinhaTimelineEvent,
} from './_helpers';

export async function carregarVaquinha() {
  const ano = edicaoAtual();
  const inicio = `${ano}-03-01 00:00:00`;
  const fim = `${ano + 1}-03-01 00:00:00`;

  const [settingsRes, participantsRes, purchasesRes] = await Promise.all([
    query<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = 'contribution_value' LIMIT 1`,
    ),
    query<{
      id: number;
      name: string;
      paid: boolean;
      paid_date: Date | string | null;
      user_id: number | null;
      avatar_url: string | null;
      pix: boolean;
      pix_amount: string | number | null;
      pix_paid_at: Date | string | null;
    }>(
      `SELECT p.id, p.name, p.paid, p.paid_date, p.user_id, u.avatar_url,
              (pix.participant_id IS NOT NULL) AS pix,
              pix.amount AS pix_amount,
              pix.paid_at AS pix_paid_at
         FROM participants p
         LEFT JOIN family_users u ON u.id = p.user_id
         LEFT JOIN (
           SELECT participant_id, SUM(amount) AS amount, MAX(paid_at) AS paid_at
             FROM payments
            WHERE status = 'PAID' AND created_at >= $1::timestamp AND created_at < $2::timestamp
            GROUP BY participant_id
         ) pix ON pix.participant_id = p.id
        ORDER BY p.name ASC, p.id ASC`, [inicio, fim],
    ),
    query<{
      id: number;
      description: string;
      value_centavos: string | number;
      category: string | null;
      brand: string | null;
      color: string | null;
      size: string | null;
      quantity: number | null;
      notes: string | null;
      image_url: string | null;
      receipt_url: string | null;
      image_urls: string | null;
      created_at: Date | string;
    }>(
      `SELECT id, description, value_centavos, category, brand, color, size, quantity, notes,
              image_url, image_urls, receipt_url, created_at
         FROM purchases
        WHERE ano = $1
        ORDER BY created_at DESC, id DESC`, [ano],
    ),
  ]);

  const rawContribution = Number(settingsRes.rows[0]?.value);
  const contribution_value =
    Number.isFinite(rawContribution) && rawContribution >= 0 ? roundMoney(rawContribution) : 50;

  const participants: VaquinhaParticipant[] = participantsRes.rows.map((row) => ({
    id: row.id,
    name: row.name,
    paid: Boolean(row.paid),
    paid_date: row.paid_date ? new Date(row.paid_date).toISOString() : null,
    user_id: row.user_id ?? null,
    avatar_url: row.avatar_url ?? null,
    pix: Boolean(row.pix),
  }));

  const purchases: VaquinhaPurchase[] = purchasesRes.rows.map((row) => ({
    id: row.id,
    description: row.description,
    value: Number(row.value_centavos) / 100,
    category: row.category || 'Outros',
    brand: row.brand ?? null,
    color: row.color ?? null,
    size: row.size ?? null,
    quantity: Number(row.quantity) > 0 ? Number(row.quantity) : 1,
    notes: row.notes ?? null,
    images: parseImages(row.image_url, row.image_urls),
    receipt_url: row.receipt_url,
    created_at: new Date(row.created_at).toISOString(),
  }));

  const meta = await consultarMeta();
  const arrecadado = meta.arrecadado_centavos / 100;
  const gasto = roundMoney(purchases.reduce((acc, p) => acc + p.value, 0));
  const saldo = roundMoney(arrecadado - gasto);

  const paymentEvents: VaquinhaTimelineEvent[] = participantsRes.rows
    .filter((row) => Boolean(row.pix) || Boolean(row.paid))
    .map((row) => {
      const pix = Boolean(row.pix);
      const when = (pix && row.pix_paid_at) || row.paid_date;
      return {
        id: `payment-${row.id}`,
        ref_id: row.id,
        type: 'payment' as const,
        description: `Contribuição de ${row.name}`,
        value: 0, // Valores individuais nunca saem na resposta.
        date: when ? new Date(when).toISOString() : new Date(0).toISOString(),
        name: row.name,
        avatar_url: row.avatar_url ?? null,
        category: null,
        brand: null,
        color: null,
        size: null,
        quantity: null,
        notes: null,
        images: [],
      };
    });

  const purchaseEvents: VaquinhaTimelineEvent[] = purchases.map((pur) => ({
    id: `purchase-${pur.id}`,
    ref_id: pur.id,
    type: 'purchase',
    description: pur.description,
    value: pur.value,
    date: pur.created_at,
    name: null,
    avatar_url: null,
    category: pur.category,
    brand: pur.brand,
    color: pur.color,
    size: pur.size,
    quantity: pur.quantity,
    notes: pur.notes,
    images: pur.images,
  }));

  const timeline = [...paymentEvents, ...purchaseEvents].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return {
    ...meta,
    ano,
    contribution_value,
    arrecadado,
    gasto,
    saldo,
    participants,
    purchases,
    timeline,
  };
}
