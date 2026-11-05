export interface SantaConfig {
  id: number;
  min_gift_value: number | null;
  max_gift_value: number | null;
  reveal_date: string | null;
}

export interface Receiver {
  participant_id: number;
  name: string;
  avatar_url: string | null;
}

export interface SantaResponse {
  config: SantaConfig | null;
  participating: boolean;
  draw: { revealed: boolean; receiver?: Receiver } | null;
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

export interface WishResponse {
  items: WishItem[];
  config_id: number | null;
}

export interface AdminParticipant {
  id: number;
  name: string;
  has_login: boolean;
}

export interface AdminResponse {
  config: SantaConfig | null;
  participants: AdminParticipant[];
  status: { name: string; revealed: boolean }[];
}

export function sortWishes(items: WishItem[]): WishItem[] {
  return [...items].sort((a, b) => b.priority - a.priority || a.created_at.localeCompare(b.created_at) || a.id - b.id);
}
