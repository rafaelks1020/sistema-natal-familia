// Contrato entre o motor/APIs da gamificação e as telas. Sem import de servidor: o cliente usa `import type`.
// Ver docs/GAMIFICACAO.md.

export type Origem = 'uso' | 'brincadeira' | 'karaoke' | 'conquista' | 'missao' | 'ajuste';
export type NivelConquista = 'bronze' | 'prata' | 'ouro' | 'lendaria';
export type CategoriaConquista =
  | 'familia' | 'fotografo' | 'prosa' | 'advento' | 'ceia' | 'festa' | 'karaoke' | 'generoso' | 'memorias' | 'secretas';

export interface Lancamento {
  regra: string;
  ref?: string; // exposto somente para admin
  origem: Origem;
  pontos: number;
  descricao: string;
  ocorreu_em: string; // ISO
}

export interface DiaExtrato {
  dia: string; // AAAA-MM-DD (São Paulo)
  total: number;
  lancamentos: Lancamento[];
}

export interface ConquistaVista {
  id: string;
  categoria: CategoriaConquista;
  nome: string;        // '???' quando secreta e ainda não ganha por ninguém
  descricao: string;   // idem
  nivel: NivelConquista;
  icone: string;       // nome de ícone do lucide-react
  secreta: boolean;
  pontos: number;      // 0 nas conquistas de dinheiro
  ganha_em: string | null;
  progresso: { atual: number; meta: number } | null; // null quando não é contável
  quantos_ganharam: number;
}

export interface LinhaRanking {
  posicao: number;
  user_id: number;
  nome: string;
  avatar_url: string | null;
  total: number;
  conquistas: number;
}

export interface RegraVista {
  regra: string;
  origem: Origem;
  titulo: string;   // "Abrir o app"
  pontos: string;   // "5" ou "nota da música" ou "50 / 30 / 20"
  teto: string | null; // "1 por dia"
}

export interface PainelPontos {
  ano: number;
  agora: string;
  encerra_em: string;
  ranking_oculto_em: string;
  encerrado: boolean;
  revelado: boolean;
  user_id: number;
  total: number;
  por_origem: Record<Origem, number>;
  posicao: number | null;          // null quando o ranking está oculto
  ranking: LinhaRanking[] | null;  // null quando oculto
  extrato: DiaExtrato[];           // mais recente primeiro
  conquistas: ConquistaVista[];
  conquistas_ganhas: number;
  conquistas_total: number;
  regras: RegraVista[];
  atualizado_em: string;           // último recálculo
}

export interface PerfilPontos {
  user_id: number;
  nome: string;
  avatar_url: string | null;
  total: number | null; // null quando o ranking está oculto
  conquistas: ConquistaVista[];
}

export type TipoMissao = 'foto' | 'texto' | 'foto_texto';

export interface RespostaMissao {
  id: number;
  user_id: number;
  nome: string;
  avatar_url: string | null;
  texto: string | null;
  image_url: string | null;
  status: 'aprovada' | 'recusada';
  motivo_recusa: string | null;
  created_at: string;
  minha: boolean;
}

export interface Missao {
  id: number;
  titulo: string;
  descricao: string;
  tipo: TipoMissao;
  pontos: number;
  inicia_em: string;
  termina_em: string;
  estado: 'agendada' | 'ativa' | 'encerrada';
  minha_resposta: RespostaMissao | null;
  respostas: RespostaMissao[]; // só aprovadas (admin vê todas)
  total_respostas: number;
}

export interface PainelMissoes {
  ano: number;
  agora: string;
  ativas: Missao[];
  passadas: Missao[];
  agendadas: Missao[]; // só para admin; vazio para os demais
}

export interface ModeloMissao {
  id: string;
  titulo: string;
  descricao: string;
  tipo: TipoMissao;
  pontos: number;
}

export interface ConfigGamificacao {
  ano: number;
  encerra_em: string;
  ranking_oculto_em: string;
  revelado_em: string | null;
  missoes_surpresa: boolean;
  excluidos?: number[];
}

export interface PessoaCompeticao {
  id: number;
  nome: string;
  avatar_url: string | null;
  excluido: boolean;
}

export interface AjusteVisto {
  id: number;
  user_id: number;
  nome: string;
  pontos: number;
  motivo: string;
  anula_ref: string | null;
  criado_por_nome: string;
  created_at: string;
}

export interface PainelAdminGamificacao {
  config: ConfigGamificacao;
  ranking: LinhaRanking[]; // sempre completo
  pessoas?: PessoaCompeticao[];
  ajustes: AjusteVisto[];
  modelos: ModeloMissao[];
  missoes: Missao[];       // todas do ano (respostas incluem recusadas)
  atualizado_em: string;
}

export interface RevelacaoTelao {
  revelado: boolean;
  campeao: LinhaRanking[]; // top 5
  prova: { posicao: number; user_id: number; nome: string; avatar_url: string | null; nota_final: number | null; soma_eliminatoria: number }[]; // top 4
}
