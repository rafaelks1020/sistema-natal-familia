import { query } from '@/app/lib/db';

// Config ativo mais recente. reveal_date sai como texto (YYYY-MM-DD) para não
// escorregar de dia por causa do fuso. Valores em número, não string do DECIMAL.

export interface SantaConfig {
  id: number;
  min_gift_value: number | null;
  max_gift_value: number | null;
  reveal_date: string | null;
}

interface ConfigRow {
  id: number;
  min_gift_value: unknown;
  max_gift_value: unknown;
  reveal_date: string | null;
}

function num(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export function mapConfig(row: ConfigRow): SantaConfig {
  return {
    id: row.id,
    min_gift_value: num(row.min_gift_value),
    max_gift_value: num(row.max_gift_value),
    reveal_date: row.reveal_date,
  };
}

const CONFIG_SQL = `SELECT id,
            min_gift_value::float8 AS min_gift_value,
            max_gift_value::float8 AS max_gift_value,
            to_char(reveal_date, 'YYYY-MM-DD') AS reveal_date
       FROM secret_santa_config`;

export async function loadActiveConfig(): Promise<SantaConfig | null> {
  const { rows } = await query<ConfigRow>(
    `${CONFIG_SQL}
      WHERE is_active IS TRUE
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
  );
  return rows[0] ? mapConfig(rows[0]) : null;
}

export interface Receiver {
  participant_id: number;
  name: string;
  avatar_url: string | null;
}

interface DrawRow {
  revealed: boolean | null;
  participant_id: number | null;
  name: string | null;
  avatar_url: string | null;
}

/**
 * O nome do sorteado só entra no resultado se revealed for true.
 * O CASE fica no SQL para a coluna não vir preenchida antes da hora.
 */
export async function loadMyDraw(participantId: number, configId: number): Promise<{
  revealed: boolean;
  receiver: Receiver | null;
} | null> {
  const { rows } = await query<DrawRow>(
    `SELECT d.revealed,
            CASE WHEN d.revealed IS TRUE THEN r.id END AS participant_id,
            CASE WHEN d.revealed IS TRUE THEN r.name END AS name,
            CASE WHEN d.revealed IS TRUE THEN u.avatar_url END AS avatar_url
       FROM secret_santa_draws d
       JOIN participants r ON r.id = d.receiver_id
       LEFT JOIN family_users u ON u.id = r.user_id
      WHERE d.config_id = $1 AND d.giver_id = $2`,
    [configId, participantId],
  );
  const row = rows[0];
  if (!row) return null;
  const revealed = row.revealed === true;
  if (!revealed || row.participant_id == null || !row.name) {
    return { revealed: false, receiver: null };
  }
  return {
    revealed: true,
    receiver: {
      participant_id: row.participant_id,
      name: row.name,
      avatar_url: row.avatar_url,
    },
  };
}

/** A abertura considera o dia civil de São Paulo, sem depender do fuso do servidor. */
export function canReveal(config: SantaConfig | null, now = new Date()): boolean {
  if (!config) return false;
  if (!config.reveal_date) return true;
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  return today >= config.reveal_date;
}
