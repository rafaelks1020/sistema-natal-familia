export interface VaquinhaParticipant {
  id: number;
  name: string;
  paid: boolean;
  paid_date: string | null;
  user_id: number | null;
  avatar_url: string | null;
  /** Há payment PAID: a baixa foi pelo Pix e não pode ser desmarcada. */
  pix: boolean;
}

export interface VaquinhaPurchase {
  id: number;
  description: string;
  value: number;
  category: string;
  brand: string | null;
  color: string | null;
  size: string | null;
  quantity: number;
  notes: string | null;
  images: string[];
  created_at: string;
}

export interface VaquinhaTimelineEvent {
  id: string;
  ref_id: number;
  type: 'payment' | 'purchase';
  description: string;
  value: number;
  date: string;
  name: string | null;
  avatar_url: string | null;
  category: string | null;
  brand: string | null;
  color: string | null;
  size: string | null;
  quantity: number | null;
  notes: string | null;
  images: string[];
}

export const ALLOWED_CATEGORIES = [
  'Ceia',
  'Bebidas',
  'Decoração',
  'Presentes',
  'Outros',
] as const;

export type PurchaseCategory = (typeof ALLOWED_CATEGORIES)[number];

export function parseImages(imageUrl: string | null, imageUrls: string | null): string[] {
  const list: string[] = [];
  if (imageUrls) {
    try {
      const parsed = JSON.parse(imageUrls);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === 'string' && item.trim()) {
            list.push(item.trim());
          }
        }
      }
    } catch {
      // ignora JSON malformado legado
    }
  }
  if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim()) {
    const trimmed = imageUrl.trim();
    if (!list.includes(trimmed)) {
      list.unshift(trimmed);
    }
  }
  return list;
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
