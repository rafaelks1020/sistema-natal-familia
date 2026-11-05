export interface BaseEntry {
  id: number; ano: number; user_id: number; titulo: string;
  audio_url: string | null; foto_url: string | null; created_at: string;
  author_name: string; avatar_url: string | null;
}
export interface Recipe extends BaseEntry {
  de_quem: string; categoria: string; ingredientes: string;
  modo_preparo: string; segredo: string | null; updated_at: string;
}
export interface Story extends BaseEntry {
  quem_conta: string; epoca: string; transcricao: string | null; duracao_s: number;
}
export type Entry = Recipe | Story;
export type Kind = 'receitas' | 'historias';
export type Draft = {
  titulo: string; de_quem: string; quem_conta: string; categoria: string;
  ingredientes: string; modo_preparo: string; segredo: string; epoca: string;
  audio_url: string; foto_url: string; transcricao: string; duracao_s: number;
};
export const categories = ['Pratos principais', 'Acompanhamentos', 'Sobremesas', 'Bebidas', 'Outras'];
export const empty: Draft = { titulo: '', de_quem: '', quem_conta: '', categoria: 'Pratos principais', ingredientes: '', modo_preparo: '', segredo: '', epoca: '', audio_url: '', foto_url: '', transcricao: '', duracao_s: 0 };
export function draftFrom(item?: Entry): Draft {
  return item ? { ...empty, ...item, audio_url: item.audio_url ?? '', foto_url: item.foto_url ?? '',
    segredo: 'segredo' in item ? item.segredo ?? '' : '', transcricao: 'transcricao' in item ? item.transcricao ?? '' : '' } : { ...empty };
}
