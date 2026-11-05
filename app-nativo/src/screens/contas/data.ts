export interface Pessoa { id: number; name: string; pix_key: string | null; confirmou: boolean; saldo_centavos: number }
export interface Despesa { id: number; user_id: number; descricao: string; valor_centavos: number; comprovante_url: string | null; partes: number[] }
export interface Transferencia { de_user_id: number; para_user_id: number; valor_centavos: number }
export interface ContasData {
  ano: number; pessoas: Pessoa[]; despesas: Despesa[]; transferencias: Transferencia[];
  acertos: (Transferencia & { id: number; confirmado_em: string })[]; minha_chave: string; total_centavos: number;
  denuncias: { id: number; alvo_id: number; autor_id: number; trecho: string; motivo: string }[];
}
export const contasKey = ['contas-da-ceia', 'edicao'] as const;
