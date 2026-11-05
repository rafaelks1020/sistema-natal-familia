export type CategoriaPrato = 'salgado' | 'doce' | 'bebida' | 'descartavel' | 'outro';
export type TipoVotacao = 'local' | 'cardapio' | 'data' | 'outro';
export type StatusPresenca = 'yes' | 'maybe' | 'no';

export interface CeiaEvento {
  event_title: string;
  event_date: string;
  event_place: string;
  contribution_value: number;
}

export interface CeiaPessoa {
  participant_id: number;
  name: string;
  avatar_url: string | null;
  status: StatusPresenca;
  adultos: number;
  criancas: number;
  restricao: string | null;
}

export interface CeiaTotais {
  confirmados: number;
  adultos: number;
  criancas: number;
  pessoas: number;
}

export interface CeiaPresenca {
  status: StatusPresenca | null;
  adultos: number;
  criancas: number;
  restricao: string | null;
  pessoas: CeiaPessoa[];
  totais: CeiaTotais;
}

export interface CeiaPrato {
  id: number;
  nome: string;
  categoria: CategoriaPrato;
  quantidade: string | null;
  user_id: number;
  autor_nome: string;
  responsavel_id: number | null;
  responsavel_nome: string | null;
  created_at: string;
}

export interface CeiaOpcao {
  id: number;
  texto: string;
  votos: number;
}

export interface CeiaVotacao {
  id: number;
  pergunta: string;
  tipo: TipoVotacao;
  aberta: boolean;
  criado_por: number;
  created_at: string;
  opcoes: CeiaOpcao[];
  meu_voto: number | null;
  total: number;
}

export interface CeiaDados {
  ano: number;
  evento: CeiaEvento;
  presenca: CeiaPresenca;
  pratos: CeiaPrato[];
  votacoes: CeiaVotacao[];
}

export const CATEGORIAS: { id: CategoriaPrato; rotulo: string }[] = [
  { id: 'salgado', rotulo: 'Salgados' },
  { id: 'doce', rotulo: 'Doces' },
  { id: 'bebida', rotulo: 'Bebidas' },
  { id: 'descartavel', rotulo: 'Descartáveis' },
  { id: 'outro', rotulo: 'Outros' },
];

export const TIPOS_VOTACAO: { id: TipoVotacao; rotulo: string }[] = [
  { id: 'local', rotulo: 'Local' },
  { id: 'cardapio', rotulo: 'Cardápio' },
  { id: 'data', rotulo: 'Data' },
  { id: 'outro', rotulo: 'Outro' },
];
