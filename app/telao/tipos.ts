// Tipos do telão: sem acesso ao banco, servem para o servidor e para o navegador.
import type { Slide } from '@/app/api/telao/data';
import type { JogoNovo } from '@/app/api/telao/estado/_jogos_novos';
import type { ItemRoteiro } from './roteiro';

export type { Slide, JogoNovo, ItemRoteiro };

export const CENAS = ['fotos', 'tocando', 'contagem', 'recados', 'advento', 'virada', 'ceia', 'linha', 'lareira', 'papainoel', 'brinde', 'karaoke'] as const;
export type Cena = (typeof CENAS)[number];

export const NOMES_CENA: Record<Cena, string> = {
  fotos: 'Fotos ao vivo',
  tocando: 'Tocando agora',
  contagem: 'Contagem regressiva',
  recados: 'Recados do mural',
  advento: 'Advento do dia',
  virada: 'Virada da meia-noite',
  ceia: 'A ceia está servida',
  linha: 'Natal através dos anos',
  lareira: 'Lareira',
  papainoel: 'Papai Noel a caminho',
  brinde: 'Hora do brinde',
  karaoke: 'Karaokê da música',
};

/** Frase da cena de brinde quando ninguém escreveu uma. */
export const FRASE_BRINDE_PADRAO = 'Ao amor desta família!';

export const AVISO_SEGUNDOS = 15;

export function ehCena(valor: unknown): valor is Cena {
  return typeof valor === 'string' && (CENAS as readonly string[]).includes(valor);
}

export interface ComandoTelao {
  /** comando_em em ISO: identifica o comando para executar uma vez só. */
  id: string;
  tipo: 'proxima' | 'anterior' | 'aviso' | 'brinde';
  /** Aviso: o texto. Brinde: a frase. */
  texto: string;
  idade_ms: number;
}

export interface ControleTelao {
  cena_fixa: Cena | null;
  pausado: boolean;
  comando: ComandoTelao | null;
}

export interface PratoCeia {
  nome: string;
  categoria: string | null;
  quem: string;
}

export interface FotoOficial {
  ano: number;
  url: string;
  legenda: string | null;
}

export interface EventoTelao {
  /** Hora da ceia (event_date). */
  ceia: string;
  /** A partir daqui a contagem passa a mirar a meia-noite (dia 24 depois das 20h, ou a hora da ceia). */
  troca: string;
  meiaNoite: string;
}

export interface TocandoTelao {
  tocando: boolean;
  nome: string | null;
  artista: string | null;
  capa_url: string | null;
  progresso_ms: number;
  duracao_ms: number;
  adicionada_por: string | null;
}

export interface Recado {
  id: number;
  nome: string;
  texto: string;
  foto: string | null;
  created_at: string;
}

export interface AdventoHoje {
  dia: number;
  tipo: string;
  titulo: string;
  texto: string;
  image_url: string | null;
  opcoes: string[] | null;
}

export interface PlacarItem {
  nome: string;
  pontos: number;
  acertos: number;
}

export interface JogoQuiz {
  tipo: 'quiz';
  fase: 'aberta' | 'revelada' | 'podio';
  numero: number;
  total: number;
  modelo: string;
  pergunta: string;
  image_url: string | null;
  opcoes: string[];
  /** Só vem depois que a pergunta fechou. */
  correta: number | null;
  total_respostas: number;
  /** Quanto falta para fechar, em ms (só na fase aberta). */
  restante_ms: number;
  duracao_ms: number;
  placar: PlacarItem[];
}

export interface JogoEnquete {
  tipo: 'enquete';
  id: number;
  pergunta: string;
  aberta: boolean;
  total_votos: number;
  opcoes: { texto: string; votos: number; percentual: number; vencedora: boolean }[];
}

export interface JogoBingo {
  tipo: 'bingo';
  confirmado: boolean;
  nome: string;
  padrao: string;
  outros: string[];
}

export interface JogoAmigo {
  tipo: 'amigo';
  atual: number;
  total: number;
  encerrado: boolean;
  /** Só o par já revelado (o atual). Nunca os próximos. */
  par: { giver: string; receiver: string; acertos: string[] } | null;
  iniciado_em: string;
}

export type Jogo = JogoQuiz | JogoEnquete | JogoBingo | JogoAmigo;

export interface EstadoTelao {
  agora: string;
  ano: number;
  meId: number;
  /** Quem abre o telão é admin: só ele controla o Spotify do telão. */
  souAdmin: boolean;
  controle: ControleTelao;
  evento: EventoTelao;
  /** Muda quando entra ou sai foto ou recado: o telão busca a lista de novo. */
  marca: string;
  /** null = o Spotify não respondeu agora (mantém o que já estava na tela). */
  tocando: TocandoTelao | null;
  jogo: Jogo | null;
  /** Jogos novos em tela grande (mímica, bebê, roleta, times). */
  jogoNovo: JogoNovo | null;
  /** Roteiro da noite do ano (leve: poucas linhas). */
  roteiro: ItemRoteiro[];
  fotos?: Slide[];
  recados?: Recado[];
  /** null = fora de 1 a 24/12. */
  advento?: AdventoHoje | null;
  placar?: PlacarItem[];
  presentes?: { total: number; nomes: string[] };
  pratos?: PratoCeia[];
  fotosOficiais?: FotoOficial[];
  /** Quem já entrou hoje (nomes para a virada). */
  nomesPresentes?: string[];
}

export const SECOES = ['fotos', 'recados', 'advento', 'placar', 'presentes', 'ceia', 'linha', 'nomes'] as const;
export type Secao = (typeof SECOES)[number];
