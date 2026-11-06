// Formato das respostas de /api/karaoke/fila, /api/karaoke/buscar e /api/karaoke/musica (compartilhado pelo celular e pelo telão).

export type LinhaLetra = { ms: number; texto: string };

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
  /** 'letra': letra própria na tela; 'video': letra do próprio vídeo. */
  modo: 'letra' | 'video';
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
