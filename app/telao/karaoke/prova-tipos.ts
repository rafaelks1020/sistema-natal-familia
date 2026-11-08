import type { ResultadoEstudio } from './pontuacao';
export type FaseProva = 'eliminatoria' | 'final';
export type StatusProva = 'preparando' | 'eliminatoria' | 'final' | 'encerrada';
export interface ConfigProva {
  ano: number; musicas: number[]; eliminatoria_ate: string; final_em: string;
  final_musica: number | null; status: StatusProva;
}
export interface TentativaProva {
  id: number; user_id: number; catalogo_id: number; fase: FaseProva; fila_id: number;
  nota: number | null; detalhes: Record<string, unknown>; status: 'cantando' | 'valida' | 'abandonada' | 'anulada';
  iniciada_em: string; terminada_em: string | null;
}
export interface ClassificadoProva {
  posicao: number; user_id: number; nome: string; avatar_url: string | null;
  soma_eliminatoria: number; afinacao_media: number; nota_final: number | null;
  notas: { catalogo_id: number; nota: number }[];
}
export interface FinalistaProva { posicao: number; user_id: number; nome: string; avatar_url: string | null }
export interface MusicaProva { id: number; faixa: string; artista: string }
/** Linha da lista de conferência da organização (só admin recebe). */
export interface TentativaAdminProva {
  id: number; user_id: number; nome: string; catalogo_id: number; musica: string; fase: FaseProva;
  nota: number | null; status: TentativaProva['status']; iniciada_em: string;
  suspeita: string[]; video_url: string | null; motivo_anulacao: string | null;
}
export interface PainelProva {
  ano: number; eu: number; admin: boolean; config: ConfigProva | null; musicas: MusicaProva[];
  minhas_tentativas: TentativaProva[]; classificacao: ClassificadoProva[] | null;
  finalistas: FinalistaProva[] | null; resultado_final: ClassificadoProva[] | null;
  ranking_oculto_em: string; pessoas: { id: number; nome: string }[];
  /** Só para admin: todas as tentativas, inclusive anuladas, com suspeitas e vídeo. */
  tentativas_admin?: TentativaAdminProva[];
}
export interface NotaOficial extends ResultadoEstudio { abandonada: boolean }
