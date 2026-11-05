// Tipos e sugestões da enquete ao vivo: sem acesso ao banco, podem ir para o navegador.
export interface LivePollOptionStat {
  index: number;
  texto: string;
  votos: number;
  percentual: number;
  vencedora: boolean;
}

export interface LivePollItem {
  id: number;
  pergunta: string;
  aberta: boolean;
  encerrada_em: string | null;
  created_at: string;
  total_votos: number;
  meu_voto: number | null;
  opcoes: LivePollOptionStat[];
}

export interface EnqueteData {
  ano: number;
  enquete_destaque: LivePollItem | null;
  enquetes: LivePollItem[];
}

export const SUGESTOES_ENQUETE: ReadonlyArray<{
  pergunta: string;
  opcoes: readonly string[];
}> = [
  {
    pergunta: 'Qual prato salgado está ganhando a noite?',
    opcoes: ['Peru ou Chester', 'Pernil assado', 'Salpicão e acompanhamentos', 'Farofa caprichada'],
  },
  {
    pergunta: 'Na sobremesa da família, quem leva o troféu?',
    opcoes: ['Rabanada quentinha', 'Pavê tradicional', 'Pudim de leite', 'Panetone ou Chocotone'],
  },
  {
    pergunta: 'Que horas devemos abrir os presentes do Amigo Oculto?',
    opcoes: ['Agora mesmo!', 'Logo antes da ceia', 'Depois da ceia', 'À meia-noite em ponto'],
  },
  {
    pergunta: 'Arroz com uva-passa na ceia de Natal:',
    opcoes: ['Com certeza, é tradição!', 'Passo longe, prefiro sem', 'Como tudo sem reclamar'],
  },
];
