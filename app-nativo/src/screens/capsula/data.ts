export interface PessoaResumo { id: number; name: string }
export interface CapsulaMinha {
  id: number; para_user_id: number | null; para_nome: string; tem_foto: boolean; abre_em_texto: string; pode_editar: boolean;
}
export interface CapsulaAberta {
  id: number; user_id: number; author_name: string; avatar_url: string | null; para_nome: string;
  texto: string; image_url: string | null; pode_apagar: boolean;
}
export interface CapsulaDados {
  ano: number;
  eu: { id: number; admin: boolean };
  familia: PessoaResumo[];
  abertura_texto: string;
  frase: string;
  total_lacradas: number;
  minhas: CapsulaMinha[];
  aguardando: { total: number; abre_em_texto: string } | null;
  abertas: CapsulaAberta[];
}
export const capsulaKey = ['capsula', 'edicao'] as const;
