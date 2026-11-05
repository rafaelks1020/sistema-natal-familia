import { HttpError, cleanText } from '@/app/lib/api';
import { query } from '@/app/lib/db';

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
  participant_id: number;
  item_name: string;
  item_description: string | null;
  item_url: string | null;
  priority: number;
  purchased: boolean | null;
  created_at: Date | string;
}

export interface WishItem {
  id: number;
  item_name: string;
  item_description: string | null;
  item_url: string | null;
  priority: number;
  created_at: string;
  purchased?: boolean;
}

/** O dono da lista não recebe `purchased` (a compra é surpresa). Os demais recebem. */
export function presentWish(row: WishRow, viewerParticipantId: number | null): WishItem {
  const item: WishItem = {
    id: row.id,
    item_name: row.item_name,
    item_description: row.item_description,
    item_url: row.item_url,
    priority: Number(row.priority) || 1,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
  const owner = viewerParticipantId != null && row.participant_id === viewerParticipantId;
  if (!owner) item.purchased = row.purchased === true;
  return item;
}

export const WISH_RETURNING = `id, participant_id, item_name, item_description, item_url, priority, purchased, created_at`;

export function parsePriority(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (n !== 1 && n !== 2 && n !== 3) throw new HttpError(400, 'A prioridade vai de 1 a 3.');
  return n;
}

/** Link opcional. Vazio vira null. Só https. */
export function parseItemUrl(value: unknown): string | null {
  if (value == null) return null;
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return null;
  if (s.length > 500) throw new HttpError(400, 'O link passou de 500 caracteres.');
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    throw new HttpError(400, 'O link precisa começar com https://');
  }
  if (url.protocol !== 'https:') throw new HttpError(400, 'O link precisa começar com https://');
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
