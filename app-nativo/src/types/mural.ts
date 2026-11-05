export type ReactionType = 'coracao' | 'estrela' | 'risada' | 'brinde';

export interface CommentItem {
  id: number;
  user_id: number;
  user_name: string;
  avatar_url: string | null;
  content: string;
  created_at: string;
  likes: number;
  liked_by_me: boolean;
}

export interface PostItem {
  id: number;
  user_id: number;
  user_name: string;
  avatar_url: string | null;
  content: string;
  images: string[];
  pinned: boolean;
  created_at: string;
  updated_at: string | null;
  reactions: Record<string, number>;
  my_reactions: string[];
  comments: CommentItem[];
  comments_count: number;
}

/** Corpo devolvido por POST e PUT, sem o miolo social do feed. */
export interface PostWrite {
  id: number;
  user_id: number;
  user_name: string;
  avatar_url: string | null;
  content: string;
  images: string[];
  pinned: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface PollItem {
  id: number;
  question: string;
  options: string[];
  votes: number[];
  my_vote: number | null;
  total: number;
  created_by: number;
  created_by_name: string;
  created_by_avatar: string | null;
  created_at: string;
}

export interface VoteResult {
  id: number;
  votes: number[];
  my_vote: number;
  total: number;
}

export interface ReactionResult {
  status: 'added' | 'removed';
  active: boolean;
  type: string;
}

export interface CommentLikeResult {
  status: 'added' | 'removed';
  liked: boolean;
}

export interface PinResult {
  id: number;
  pinned: boolean;
}

export interface NotificationItem {
  id: number;
  type: string;
  actor_name: string;
  actor_avatar: string | null;
  post_id: number | null;
  reaction_type: string | null;
  created_at: string;
  read: boolean;
}

export interface NotificationsResponse {
  unread: number;
  items: NotificationItem[];
}

export interface OkResult {
  ok: true;
}
