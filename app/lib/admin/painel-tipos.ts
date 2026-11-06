export type Estatisticas = {
  contagem_ativa: boolean;
  acessos: { dia: string; pessoas: number }[];
  ativos_semana: number;
  nunca_entraram: { id: number; nome: string }[];
  presenca: {
    vou: number;
    talvez: number;
    nao: number;
    adultos: number;
    criancas: number;
    pessoas: number;
  };
  vaquinha: {
    arrecadado_centavos: number;
    meta_centavos: number;
    pagaram: number;
    participantes: number;
  };
  atividade: { dia: string; posts: number; fotos: number }[];
  ranking: {
    id: number;
    nome: string;
    pontos: number;
    posts: number;
    fotos: number;
    comentarios: number;
    curtidas: number;
  }[];
};

export type AvisoAgendado = {
  id: number;
  titulo: string;
  corpo: string;
  rota: string | null;
  todos: boolean;
  pessoas: number | null;
  enviar_em: string;
  enviado_em: string | null;
  criado_por_nome: string | null;
};

export type PessoaRelatorio = {
  nome: string;
  adultos: number;
  criancas: number;
  restricao: string | null;
};

export type RelatorioCeia = {
  ano: number;
  gerado_em: string;
  evento: { titulo: string; data: string; hora: string; local: string };
  presenca: {
    vou: PessoaRelatorio[];
    talvez: PessoaRelatorio[];
    nao: PessoaRelatorio[];
    adultos: number;
    criancas: number;
    pessoas: number;
  };
  pratos: { categoria: string; rotulo: string; itens: { nome: string; quantidade: string | null; quem: string }[] }[];
  deslocamento: {
    tipo: string;
    rotulo: string;
    itens: {
      quem: string;
      origem: string;
      quando: string;
      vagas: number;
      observacao: string;
      telefone: string | null;
      reservas: { nome: string; quantidade: number }[];
    }[];
  }[];
  contas: {
    total_centavos: number;
    saldos: { nome: string; saldo_centavos: number }[];
    acertos: { de: string; para: string; valor_centavos: number }[];
  };
  vaquinha: { arrecadado_centavos: number; gasto_centavos: number; saldo_centavos: number };
  amigo: { tema: string; participantes: number };
};
