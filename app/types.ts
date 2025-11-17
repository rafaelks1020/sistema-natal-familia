export interface Participant {
  id: number;
  name: string;
  paid: boolean;
  paid_date: string | null;
}

export interface Purchase {
  id: number;
  description: string;
  value: number;
  category: string;
  brand?: string;
  color?: string;
  size?: string;
  quantity: number;
  notes?: string;
  image_url?: string;
  image_urls?: string[];
  created_at: string;
}

export interface DrawRule {
  type: 'cannot_draw';
  participant1_id: number;
  participant2_id: number;
}

export interface SecretSantaConfig {
  id: number;
  year: number;
  is_active: boolean;
  draw_date: string;
  reveal_date?: string;
  min_gift_value?: number;
  max_gift_value?: number;
  rules?: DrawRule[];
}

export interface SecretSantaDraw {
  id: number;
  receiver_id: number;
  receiver_name: string;
  revealed: boolean;
  revealed_at?: string;
}

export interface WishListItem {
  id: number;
  participant_id: number;
  participant_name?: string;
  item_name: string;
  item_description?: string;
  item_url?: string;
  priority: number;
  purchased: boolean;
}

export interface FamilyUser {
  id: number;
  name: string;
  username: string;
}

export interface FamilyPost {
  id: number;
  user_id: number;
  user_name: string;
  content: string;
  image_url?: string;
  created_at: string;
  reactions?: Record<string, number>;
  comments?: FamilyComment[];
}

export interface FamilyComment {
  id: number;
  user_id: number;
  user_name: string;
  content: string;
  created_at: string;
}

export interface FamilyPoll {
  id: number;
  question: string;
  options: string[];
  created_at: string;
  created_by_name: string;
  votes?: Record<string, number>;
}

export interface FamilyAttendance {
  participant_id: number;
  name: string;
  status: 'yes' | 'maybe' | 'no' | null;
}
