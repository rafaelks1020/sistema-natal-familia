export type AlbumFilter = 'tudo' | 'post' | 'compra';

// Contrato de GET /api/album, conferido em app/api/album/data.ts.
export interface AlbumItem {
  key: string;
  url: string;
  source: 'post' | 'compra';
  post_id?: number;
  author_name?: string;
  author_avatar?: string | null;
  caption: string;
  created_at: string;
}

export interface AlbumResponse {
  items: AlbumItem[];
  nextCursor: string | null;
}
