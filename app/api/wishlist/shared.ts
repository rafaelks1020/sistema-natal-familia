import { HttpError, cleanText, isBlobUrl } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { enviarPush } from '@/app/lib/push';

// Sem config ativo, a lista fica no último config criado (cancelar o sorteio não apaga
// os desejos). Sem nenhum config, não há onde gravar: config_id é NOT NULL.

export async function resolveWishlistConfigId(): Promise<number | null> {
  const { rows } = await query<{ id: number }>(
    `SELECT id
       FROM secret_santa_config
      ORDER BY (is_active IS TRUE) DESC, created_at DESC, id DESC
      LIMIT 1`,
  );
  return rows[0]?.id ?? null;
}

export interface WishRow {
  id: number;
  ano?: number;
  participant_id: number;
  config_id: number;
  item_name: string;
  item_description: string | null;
  item_url: string | null;
  priority: number;
  price_min_cents: number | null;
  price_max_cents: number | null;
  image_url: string | null;
  purchased: boolean | null;
  purchased_by_me?: boolean | null;
  created_at: Date | string;
}

export interface WishItem {
  id: number;
  item_name: string;
  item_description: string | null;
  item_url: string | null;
  priority: number;
  price_min_cents: number | null;
  price_max_cents: number | null;
  image_url: string | null;
  created_at: string;
  purchased?: boolean;
  purchased_by_me?: boolean;
}

export interface WishParticipant {
  id: number;
  name: string;
  avatar_url: string | null;
  wish_count: number;
}

/** O dono da lista NUNCA recebe `purchased` nem `purchased_by_me` (a compra é surpresa). Os demais recebem. */
export function presentWish(row: WishRow, viewerParticipantId: number | null): WishItem {
  const item: WishItem = {
    id: row.id,
    item_name: row.item_name,
    item_description: row.item_description,
    item_url: row.item_url,
    priority: Number(row.priority) || 1,
    price_min_cents: row.price_min_cents != null ? Number(row.price_min_cents) : null,
    price_max_cents: row.price_max_cents != null ? Number(row.price_max_cents) : null,
    image_url: row.image_url ?? null,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
  const owner = viewerParticipantId != null && row.participant_id === viewerParticipantId;
  if (!owner) {
    item.purchased = row.purchased === true;
    item.purchased_by_me = row.purchased_by_me === true;
  }
  return item;
}

export const WISH_RETURNING = `id, ano, participant_id, config_id, item_name, item_description, item_url, priority, price_min_cents, price_max_cents, image_url, purchased, created_at`;

export function parsePriority(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (n !== 1 && n !== 2 && n !== 3) throw new HttpError(400, 'A prioridade vai de 1 a 3.');
  return n;
}

/** Link opcional. Vazio vira null. Aceita http:// e https://. */
export function parseItemUrl(value: unknown): string | null {
  if (value == null) return null;
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return null;
  if (s.length > 500) throw new HttpError(400, 'O link passou de 500 caracteres.');
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    throw new HttpError(400, 'O link precisa começar com http:// ou https://');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HttpError(400, 'O link precisa começar com http:// ou https://');
  }
  if (!url.hostname) {
    throw new HttpError(400, 'O link precisa ter um endereço válido.');
  }
  const normalized = url.toString();
  if (normalized.length > 500) throw new HttpError(400, 'O link passou de 500 caracteres.');
  return normalized;
}

export function parseItemName(value: unknown): string {
  return cleanText(value, 'o nome do presente', 120);
}

export function parseItemDescription(value: unknown): string | null {
  const text = cleanText(value, 'a descrição', 400, false);
  return text || null;
}

export function parsePriceCents(value: unknown, label: string): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new HttpError(400, `Informe ${label} em centavos inteiros.`);
  }
  if (n === 0) return null;
  if (n > 100_000_000) {
    throw new HttpError(400, `O valor informado em ${label} é alto demais.`);
  }
  return n;
}

export function validatePriceRange(minCents: number | null, maxCents: number | null): void {
  if (minCents != null && maxCents != null && minCents > maxCents) {
    throw new HttpError(400, 'O valor mínimo não pode ser maior que o valor máximo.');
  }
}

export function parseImageUrl(value: unknown): string | null {
  if (value == null) return null;
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return null;
  if (!isBlobUrl(s)) {
    throw new HttpError(400, 'Foto inválida. Envie a imagem pelo aplicativo.');
  }
  return s;
}

/**
 * Avisa por push quem tirou o dono da lista no sorteio atual.
 * Limite de 1 aviso a cada 6 horas por lista (guardado em app_settings).
 * Nunca expõe quem tirou quem.
 */
export async function notificarListaAlterada(participantId: number, configId: number): Promise<void> {
  try {
    const { rows: givers } = await query<{ user_id: number }>(
      `SELECT DISTINCT p.user_id
         FROM secret_santa_draws d
         JOIN participants p ON p.id = d.giver_id
        WHERE d.config_id = $1
          AND d.receiver_id = $2
          AND p.user_id IS NOT NULL
          AND p.id <> $2`,
      [configId, participantId],
    );
    const userIds = givers.map((r) => r.user_id).filter((id) => Number.isInteger(id) && id > 0);
    if (!userIds.length) return;

    const settingKey = `wishlist_push_6h:${configId}:${participantId}`;
    const { rows: allowed } = await query<{ key: string }>(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, NOW()::text, NOW())
       ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value,
             updated_at = NOW()
       WHERE app_settings.updated_at <= NOW() - INTERVAL '6 hours'
       RETURNING key`,
      [settingKey],
    );
    if (!allowed.length) return;

    void enviarPush(userIds, {
      titulo: 'Amigo oculto',
      corpo: 'A lista do seu amigo oculto mudou',
      rota: '/amigo-oculto',
    });
  } catch (err) {
    console.error('[wishlist:push]', err instanceof Error ? err.message : 'Falha ao verificar aviso');
  }
}
