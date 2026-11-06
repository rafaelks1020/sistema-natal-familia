import type { NotaEstudio } from './pontuacao';

// Formato das respostas de /api/karaoke/fila, /api/karaoke/buscar e /api/karaoke/musica (compartilhado pelo celular e pelo telão).

export type LinhaLetra = { ms: number; texto: string };

export type PalavraEstudio = { texto: string; inicio_ms: number; fim_ms: number };
export type LinhaEstudio = { inicio_ms: number; fim_ms: number; texto: string; palavras: PalavraEstudio[] };
/** Dados da música do catálogo do estúdio (só vêm para a que está cantando, com ?letra=1). */
export type DadosEstudio = { audio_url: string; palavras: { linhas: LinhaEstudio[] }; notas: NotaEstudio[] };
export type StatusCatalogo = 'na_fila' | 'baixando' | 'processando' | 'pronta' | 'falhou';
export type MusicaCatalogo = { id: number; slug: string; artista: string; faixa: string; status: StatusCatalogo; capa_url: string | null; duracao_ms: number | null; lrclib_id: number | null };

export const ROTULO_PREPARO: Record<StatusCatalogo, string> = {
  na_fila: 'na fila de preparo',
  baixando: 'baixando',
  processando: 'processando',
  pronta: 'pronta',
  falhou: 'não deu certo',
};

/** Mesma regra do slug do lote.py: sem acento, minúsculo, só [a-z0-9-]. */
export function slugDaMusica(artista: string, faixa: string): string {
  const s = `${artista} ${faixa}`.normalize('NFKD').replace(/\P{ASCII}/gu, '').toLowerCase();
  return s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'faixa';
}

export type ItemFila = {
  id: number;
  user_id: number;
  nome: string;
  dueto_user_id: number | null;
  dueto_nome: string | null;
  video_id: string;
  titulo: string;
  canal: string;
  duracao_s: number | null;
  miniatura: string | null;
  status: 'fila' | 'cantando' | 'feita' | 'pulada';
  posicao: number;
  nota: number | null;
  estrelas: number | null;
  faixa: string | null;
  artista: string | null;
  lrclib_id: number | null;
  /** Só vem para a música que está cantando e quando o telão pede (?letra=1). */
  letra: LinhaLetra[] | null;
  /** Ajuste da letra em ms: positivo atrasa a letra. */
  offset_ms: number;
  /** 'estudio': instrumental, letra palavra a palavra e nota pela melodia; 'letra': letra própria na tela; 'video': letra do próprio vídeo. */
  modo: 'estudio' | 'letra' | 'video';
  catalogo_id: number | null;
  catalogo_status: StatusCatalogo | null;
  capa_url: string | null;
  /** Só vem para a música que está cantando em modo estúdio e quando o telão pede (?letra=1). */
  estudio: DadosEstudio | null;
};

export type LinhaRanking = { user_id: number; nome: string; melhor: number; media: number; cantadas: number };

export type EstadoKaraoke = {
  ano: number;
  atual: ItemFila | null;
  fila: ItemFila[];
  feitas: ItemFila[];
  ranking: LinhaRanking[];
  pessoas: { id: number; nome: string }[];
  minhasPendentes: number;
  maxPendentes: number;
};

export type VideoKaraoke = { video_id: string; titulo: string; canal: string; duracao_s: number | null; miniatura: string };

export type MusicaLrclib = { id: number; faixa: string; artista: string; album: string; duracao_s: number | null; sincronizada: boolean };

/** "Maria" ou "Maria e João". */
export const quemCanta = (i: Pick<ItemFila, 'nome' | 'dueto_nome'>) => (i.dueto_nome ? `${i.nome} e ${i.dueto_nome}` : i.nome);

export function formatarDuracao(s: number | null): string {
  if (!s) return '';
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
