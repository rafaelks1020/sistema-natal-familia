// Formato das respostas de /api/karaoke/fila e /api/karaoke/buscar (compartilhado pelo celular e pelo telão).

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

/** "Maria" ou "Maria e João". */
export const quemCanta = (i: Pick<ItemFila, 'nome' | 'dueto_nome'>) => (i.dueto_nome ? `${i.nome} e ${i.dueto_nome}` : i.nome);

export function formatarDuracao(s: number | null): string {
  if (!s) return '';
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
