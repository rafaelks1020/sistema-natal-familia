// Tipos compartilhados entre a rota, a página do celular e o telão (sem código de servidor).

export type ModoMimica = 'mimica' | 'desenho';
export type StatusMimica = 'jogando' | 'acertou' | 'tempo';
export type JogoAtivoNome = 'mimica' | 'bebe' | 'roleta' | 'times';

export interface PessoaLeve { id: number; nome: string }

export interface TimeFesta {
  id: number;
  nome: string;
  cor: string;
  pontos: number;
  membros: PessoaLeve[];
}

export interface MimicaPainel {
  id: number;
  modo: ModoMimica;
  status: StatusMimica;
  quem_joga_id: number | null;
  quem_joga_nome: string;
  team_id: number | null;
  time_nome: string;
  restante_ms: number;
  duracao_s: number;
  /** Só vem preenchida para quem está jogando (e só enquanto o tempo corre). */
  palavra: string | null;
}

export interface BebePainel {
  id: number;
  foto_url: string;
  status: 'aberta' | 'revelada';
  total_votos: number;
  meu_palpite: number | null;
  /** Só na revelação (ou para quem organiza, que cadastrou a resposta). */
  resposta_id: number | null;
  resposta_nome: string | null;
  votos_por_pessoa: { nome: string; votos: number }[];
}

export interface RoletaPainel {
  id: number;
  girada: boolean;
  sorteado_nome: string | null;
  prenda: string | null;
}

export interface JogosNovosPainel {
  ano: number;
  ativo: JogoAtivoNome | null;
  times: TimeFesta[];
  mimica: MimicaPainel | null;
  bebe: BebePainel | null;
  roleta: RoletaPainel | null;
  /** Lista de pessoas para o palpite do bebê. */
  pessoas: PessoaLeve[];
  /** Só para quem organiza. */
  admin: null | { prendas: string[]; presentes: PessoaLeve[] };
}
