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

export interface SantaData {
  config: SantaConfig | null;
  can_reveal: boolean;
  reveal_opens_at: string | null;
  participating: boolean;
  draw: { revealed: boolean; receiver?: Receiver } | null;
}

export interface SantaAdminData {
  config: SantaConfig | null;
  participants: { id: number; name: string; has_login: boolean }[];
  status: { name: string; revealed: boolean }[];
}

export interface DrawRule {
  type: 'cannot_draw';
  participant1_id: number;
  participant2_id: number;
}

export interface DrawInput {
  action: 'draw';
  participant_ids: number[];
  min_gift_value: number;
  max_gift_value: number;
  reveal_date: string | null;
  rules: DrawRule[];
  force?: boolean;
}

export interface WishFields {
  item_name: string;
  item_description: string | null;
  item_url: string | null;
  priority: number;
}

export interface WishItem extends WishFields {
  id: number;
  created_at: string;
  purchased?: boolean;
}

export interface WishlistData {
  config_id: number | null;
  items: WishItem[];
}
