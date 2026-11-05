import type { AlbumItem } from '../album/types';
export interface MemoryEdition {
  ano: number; cover: string | null; photos: number; comments: number; people: number;
  highlights: AlbumItem[]; available: boolean; topPoster: { name: string; count: number } | null;
}
export interface MemorySlide { title: string; text: string; photo?: AlbumItem; url?: string }
export interface Retrospective { edition: MemoryEdition; slides: MemorySlide[] }
export interface MemoriesHome { today: AlbumItem[]; editions: MemoryEdition[]; currentYear: number }
