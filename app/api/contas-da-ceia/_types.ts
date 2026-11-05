export interface PessoaCeia { id: number; name: string; pix_key: string | null; confirmou: boolean; saldo_centavos: number }
export interface DespesaCeia {
  id: number; user_id: number; descricao: string; valor_centavos: number;
  comprovante_url: string | null; created_at: string; partes: number[];
}
export interface AcertoCeia {
  id: number; de_user_id: number; para_user_id: number; valor_centavos: number; confirmado_em: string;
}
export interface Transferencia { de_user_id: number; para_user_id: number; valor_centavos: number }
export interface DenunciaCeia { id: number; alvo_id: number; autor_id: number; trecho: string; motivo: string }
export interface ContasData {
  ano: number; pessoas: PessoaCeia[]; despesas: DespesaCeia[]; acertos: AcertoCeia[];
  transferencias: Transferencia[]; minha_chave: string; total_centavos: number; denuncias: DenunciaCeia[];
}
