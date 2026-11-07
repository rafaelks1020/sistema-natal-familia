/** Histórico completo da edição, incluindo a apresentação em andamento. */
export type EntradaFilaJusta = {
  id: number | string;
  user_id: number;
  dueto_user_id?: number | null;
  status: 'fila' | 'cantando' | 'feita' | 'pulada';
  prioridade_manual?: number | null;
  batalha_id?: string | null;
  batalha_rodada?: number | null;
};

/**
 * Rodadas por participações, inclusive duetos, sem depender de nota ou ranking.
 * Cada escolha incrementa a contagem projetada: dois pedidos da mesma pessoa
 * não tomam a vez de quem ainda não cantou. O id representa a chegada original.
 * A ordem manual do organizador prevalece. Uma batalha ocupa um bloco de duas
 * apresentações, e a segunda vem primeiro quando a primeira já começou.
 * Não altera os objetos nem a lista recebida. Devolve apenas quem está na fila.
 */
export function ordenarFilaJusta<T extends EntradaFilaJusta>(historico: readonly T[]): T[] {
  const contagens = new Map<number, number>();
  const participantes = (item: T) => [...new Set([item.user_id, ...(item.dueto_user_id == null ? [] : [item.dueto_user_id])])];
  const contar = (item: T) => {
    for (const id of participantes(item)) contagens.set(id, (contagens.get(id) ?? 0) + 1);
  };
  const iniciadas = new Set<string>();
  for (const item of historico) {
    if (item.status === 'feita' || item.status === 'cantando') {
      contar(item);
      if (item.batalha_id && item.batalha_rodada === 1) iniciadas.add(item.batalha_id);
    }
  }
  const grupos = new Map<string, T[]>();
  for (const item of historico) {
    if (item.status !== 'fila') continue;
    const chave = item.batalha_id ? `batalha:${item.batalha_id}` : `fila:${item.id}`;
    const grupo = grupos.get(chave) ?? [];
    grupo.push(item);
    grupos.set(chave, grupo);
  }
  const pendentes = [...grupos.values()];
  for (const grupo of pendentes) grupo.sort((a, b) => (a.batalha_rodada ?? 0) - (b.batalha_rodada ?? 0) || Number(a.id) - Number(b.id));
  const prioridade = (grupo: T[]) => Math.min(...grupo.map((i) => i.prioridade_manual ?? Infinity));
  const rodada = (grupo: T[]) => Math.max(...grupo.flatMap(participantes).map((id) => contagens.get(id) ?? 0));
  const chegada = (grupo: T[]) => Math.min(...grupo.map((i) => Number(i.id)));
  const continuacao = (grupo: T[]) => Boolean(grupo[0].batalha_id && iniciadas.has(grupo[0].batalha_id));
  const ordenada: T[] = [];
  while (pendentes.length) {
    pendentes.sort((a, b) => {
      const segue = Number(continuacao(b)) - Number(continuacao(a));
      if (segue) return segue;
      const pa = prioridade(a); const pb = prioridade(b);
      if (pa !== pb) return pa - pb;
      return rodada(a) - rodada(b) || chegada(a) - chegada(b);
    });
    const grupo = pendentes.shift()!;
    ordenada.push(...grupo);
    grupo.forEach(contar);
  }
  return ordenada;
}
