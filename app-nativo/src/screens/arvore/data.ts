export type TipoVinculo = 'pai_mae' | 'conjuge';
export interface PessoaArvore {
  id: number; nome: string; apelido: string | null; foto_url: string | null;
  nascimento_ano: number | null; falecimento_ano: number | null; user_id: number | null; pode_editar: boolean;
}
export interface VinculoArvore { pessoa_id: number; parente_id: number; tipo: TipoVinculo; pode_apagar: boolean }
export interface ArvoreDados {
  ano: number;
  eu: { id: number; admin: boolean };
  familia: { id: number; name: string }[];
  pessoas: PessoaArvore[];
  vinculos: VinculoArvore[];
}
export const arvoreKey = ['arvore', 'edicao'] as const;
