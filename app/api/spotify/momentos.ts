// Momentos da noite, cada um com a sua playlist. Funções puras, sem banco nem servidor.

export const MOMENTOS = {
  jantar: { nome: 'Jantar', descricao: 'Música calma para a mesa', playlist: 'Jantar', detalhe: 'Músicas calmas para o jantar de Natal.' },
  festa: { nome: 'Festa', descricao: 'Para dançar e cantar junto', playlist: '', detalhe: 'As músicas escolhidas pela nossa família para a ceia.' },
  amigo_oculto: { nome: 'Amigo oculto', descricao: 'Trilha de suspense', playlist: 'Amigo oculto', detalhe: 'Trilha de suspense para a hora do amigo oculto.' },
} as const;

export type Momento = keyof typeof MOMENTOS;
export const MOMENTO_IDS = Object.keys(MOMENTOS) as Momento[];
export const LIMITE_POR_MOMENTO = 15;

/** Sem valor vira 'festa'. Valor que não existe devolve null. */
export function parseMomento(raw: unknown): Momento | null {
  if (raw === undefined || raw === null || raw === '') return 'festa';
  return typeof raw === 'string' && Object.hasOwn(MOMENTOS, raw) ? (raw as Momento) : null;
}

/** Nome da playlist no Spotify. A da festa mantém o nome antigo, para reaproveitar a que já existe. */
export function nomePlaylist(momento: Momento, ano: number): string {
  const sufixo = MOMENTOS[momento].playlist;
  return sufixo ? `Natal em Família ${ano} - ${sufixo}` : `Natal em Família ${ano}`;
}
