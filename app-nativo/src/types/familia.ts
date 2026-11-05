export type Presenca = 'yes' | 'maybe' | 'no';

export interface Membro {
  id: number | null;
  name: string;
  username?: string | null;
  can_link?: boolean;
  avatar_url: string | null;
  bio: string | null;
  is_admin: boolean;
  participant_id: number | null;
  attendance: Presenca | null;
  has_login: boolean;
  posts_count: number;
}

export interface Desejo {
  id: number;
  item_name: string;
  item_description: string | null;
  item_url: string | null;
  purchased?: boolean;
}

export interface Perfil {
  id: number;
  name: string;
  username?: string;
  avatar_url: string | null;
  bio: string | null;
  is_admin: boolean;
  participant_id: number | null;
  posts_count: number;
  reactions_received: number;
  comments_count: number;
  wishlist: Desejo[];
}

export interface PerfilSalvo {
  id: number;
  name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  is_admin: boolean;
  participant_id: number | null;
}

export interface Publicacao {
  id: number;
  content: string;
  images: string[];
  created_at: string;
}

export interface Convite {
  id: number;
  token: string;
  label: string;
  participant_id: number | null;
  participant_name: string | null;
  max_uses: number | null;
  uses: number;
  days_left: number | null;
  created_at: string;
  joined: string[];
  status: 'ativo' | 'usado' | 'vencido' | 'cancelado';
}

export interface ConviteCriado {
  id: number;
  token: string;
  label: string;
  participant_id: number | null;
  max_uses: number | null;
  uses: number;
}

export interface ParticipanteVaquinha {
  id: number;
  name: string;
  user_id: number | null;
}

export interface AjustesEvento {
  event_title: string;
  event_date: string;
  event_place: string;
  contribution_value: number;
}

export interface AcessoAtualizado {
  id: number;
  is_admin: boolean;
}

export interface SenhaTemporaria {
  password: string;
}
