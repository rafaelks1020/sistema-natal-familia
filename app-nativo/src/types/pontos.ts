// Tipos da gamificação (cópia do contrato do site: app/lib/gamificacao/tipos.ts).

export type Origem = 'uso' | 'brincadeira' | 'karaoke' | 'conquista' | 'missao' | 'ajuste';
export type NivelConquista = 'bronze' | 'prata' | 'ouro' | 'lendaria';
export type CategoriaConquista =
  | 'familia' | 'fotografo' | 'prosa' | 'advento' | 'ceia' | 'festa' | 'karaoke' | 'generoso' | 'memorias' | 'secretas';

export interface Lancamento {
  regra: string;
  origem: Origem;
  pontos: number;
  descricao: string;
  ocorreu_em: string;
}

export interface DiaExtrato {
  dia: string;
  total: number;
  lancamentos: Lancamento[];
}

export interface ConquistaVista {
  id: string;
  categoria: CategoriaConquista;
  nome: string;
  descricao: string;
  nivel: NivelConquista;
  icone: string;
  secreta: boolean;
  pontos: number;
  ganha_em: string | null;
  progresso: { atual: number; meta: number } | null;
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
  titulo: string;
  pontos: string;
  teto: string | null;
}

/** Uma coisa simples que a pessoa pode fazer para ganhar pontos. */
export interface SugestaoPontos {
  regra: string;
  titulo: string;
  pontos: number;
  href: string;
  feitos: number;
  limite: number;
  periodo: 'dia' | 'edicao';
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
  posicao: number | null;
  ranking: LinhaRanking[] | null;
  extrato: DiaExtrato[];
  conquistas: ConquistaVista[];
  conquistas_ganhas: number;
  conquistas_total: number;
  regras: RegraVista[];
  sugestoes: SugestaoPontos[];
  atualizado_em: string;
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
  respostas: RespostaMissao[];
  total_respostas: number;
}

export interface PainelMissoes {
  ano: number;
  agora: string;
  ativas: Missao[];
  passadas: Missao[];
  agendadas: Missao[];
}
