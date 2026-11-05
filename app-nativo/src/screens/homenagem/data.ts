export interface Lembranca {
  id: number; user_id: number; name: string; avatar_url: string | null; texto: string; image_url: string | null; pode_apagar: boolean;
}
export interface Memorial {
  id: number; nome: string; foto_url: string | null; anos: string; texto: string; pessoa_arvore_id: number | null;
  autor_nome: string; velas: number; acendi: boolean; pode_editar: boolean; lembrancas: Lembranca[];
}
export interface HomenagemDados {
  ano: number;
  eu: { id: number; admin: boolean };
  pessoas: { id: number; nome: string }[];
  memoriais: Memorial[];
}
export const homenagemKey = ['homenagem', 'edicao'] as const;
