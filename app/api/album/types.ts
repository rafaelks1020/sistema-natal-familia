export interface AlbumPerson { id: number; source: 'user' | 'tree'; name: string }
export interface AlbumItem {
  key: string; url: string; source: 'post' | 'compra' | 'album';
  post_id?: number; photo_id?: number; user_id: number | null;
  author_name: string; author_avatar: string | null; caption: string;
  created_at: string; taken_on: string; ano: number; likes: number; comments: number;
  liked: boolean; can_edit: boolean; tags: AlbumPerson[];
}
export interface AlbumResponse { items: AlbumItem[]; nextCursor: string | null }
export interface AlbumMetadata { currentYear: number; years: number[]; people: AlbumPerson[]; isAdmin: boolean }
