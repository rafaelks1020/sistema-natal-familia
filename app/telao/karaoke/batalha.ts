/** As mesmas frações de perfeição de ResultadoEstudio.linhas, ordenadas por linha. */
export const MAX_LINHAS_BATALHA = 2000;

export type ResultadoBatalha = {
  completa: boolean;
  placar: [number, number];
  empates: number;
  vencedor: 1 | 2 | null;
  trechos: { linha: number; notas: [number | null, number | null]; vencedor: 1 | 2 | null }[];
};

/** Campos adicionais devolvidos pela fila após a migração 044. */
export type CamposBatalhaFila = {
  batalha_id: string | null;
  batalha_rodada: 1 | 2 | null;
  notas_linhas: number[] | null;
};

export type EstadoBatalha = {
  id: string;
  titulo: string;
  trechos: string[];
  cancelada: boolean;
  apresentacoes: {
    id: number;
    user_id: number;
    nome: string;
    rodada: 1 | 2;
    status: 'fila' | 'cantando' | 'feita' | 'pulada';
    notas_linhas: number[] | null;
  }[];
  resultado: ResultadoBatalha;
};

export function notasLinhasValidas(valor: unknown): valor is number[] {
  return Array.isArray(valor) && valor.length > 0 && valor.length <= MAX_LINHAS_BATALHA
    && Array.from(valor).every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1);
}

/** Um ponto por trecho ganho. Empate no placar permanece empate, sem desempate por nota total. */
export function compararBatalha(primeira: readonly number[] | null, segunda: readonly number[] | null): ResultadoBatalha {
  if ((primeira !== null && !notasLinhasValidas(primeira)) || (segunda !== null && !notasLinhasValidas(segunda))) {
    throw new Error('Notas por linha inválidas: envie frações de 0 a 1.');
  }
  const completa = primeira !== null && segunda !== null && primeira.length === segunda.length;
  const placar: [number, number] = [0, 0];
  let empates = 0;
  const trechos: ResultadoBatalha['trechos'] = [];
  const arredondar = (n: number | undefined) => n === undefined ? null : Math.round(n * 1000) / 1000;
  for (let linha = 0; linha < Math.max(primeira?.length ?? 0, segunda?.length ?? 0); linha++) {
    const a = arredondar(primeira?.[linha]); const b = arredondar(segunda?.[linha]);
    let vencedor: 1 | 2 | null = null;
    if (a !== null && b !== null) {
      if (a > b) { vencedor = 1; placar[0]++; }
      else if (b > a) { vencedor = 2; placar[1]++; }
      else empates++;
    }
    trechos.push({ linha, notas: [a, b], vencedor });
  }
  const vencedor = completa && placar[0] !== placar[1] ? (placar[0] > placar[1] ? 1 : 2) : null;
  return { completa, placar, empates, vencedor, trechos };
}
