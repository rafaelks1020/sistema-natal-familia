export type TipoAdvento = 'foto' | 'receita' | 'enquete' | 'desafio' | 'pergunta';

export interface JanelaGrade {
  dia: number;
  liberada: boolean;
  abriu: boolean;
  respondida: boolean;
  personalizada: boolean;
  tipo: TipoAdvento | null;
  titulo: string | null;
  texto: string | null;
  image_url: string | null;
  opcoes: string[] | null;
}

export interface RespostaAdvento {
  id: number;
  user_id: number;
  user_name: string;
  avatar_url: string | null;
  texto: string;
  image_url: string | null;
  created_at: string;
  minha: boolean;
}

export interface DiaAdvento {
  ano: number;
  dia: number;
  tipo: TipoAdvento;
  titulo: string;
  texto: string;
  image_url: string | null;
  opcoes: string[] | null;
  personalizada: boolean;
  liberada: boolean;
  organizador: boolean;
  abriu: boolean;
  respondida: boolean;
  respostas: RespostaAdvento[];
  votos: { opcao: string; total: number }[];
  meu_voto: string | null;
  total_votos: number;
}

export interface CalendarioAdvento {
  ano: number;
  fase: 'antes' | 'aberto';
  dia_liberado: number;
  dia_de_hoje: number | null;
  abre_em: string;
  agora: string;
  organizador: boolean;
  janelas: JanelaGrade[];
}

export const adventoKeys = {
  calendario: ['advento', 'calendario'] as const,
  dia: (dia: number) => ['advento', 'dia', dia] as const,
};

export const ROTULO: Record<TipoAdvento, string> = {
  foto: 'Foto',
  receita: 'Receita',
  enquete: 'Enquete',
  desafio: 'Desafio',
  pergunta: 'Pergunta',
};

export const TIPOS: TipoAdvento[] = ['foto', 'receita', 'enquete', 'desafio', 'pergunta'];

export function faltaPara(abreEm: string, agora: number) {
  const total = Math.max(0, new Date(abreEm).getTime() - agora);
  const seg = Math.floor(total / 1000);
  return {
    total,
    dias: Math.floor(seg / 86400),
    horas: Math.floor((seg % 86400) / 3600),
    minutos: Math.floor((seg % 3600) / 60),
    segundos: seg % 60,
  };
}

export function dois(n: number): string {
  return String(n).padStart(2, '0');
}
