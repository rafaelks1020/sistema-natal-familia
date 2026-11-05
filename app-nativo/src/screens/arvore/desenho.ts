// Desenho da árvore por gerações. pai_mae: pessoa_id é o filho, parente_id é o pai ou a mãe.
// Casais ficam lado a lado. Filhos ficam na geração de baixo, centralizados nos pais.

export type TipoVinculo = 'pai_mae' | 'conjuge';
export interface VinculoDesenho { pessoa_id: number; parente_id: number; tipo: TipoVinculo }
export interface CartaoPos { id: number; esquerda: number; topo: number }
export interface Linha { x1: number; y1: number; x2: number; y2: number }
export interface DesenhoArvore { cartoes: CartaoPos[]; linhas: Linha[]; largura: number; altura: number }

export const CARTAO_L = 148;
export const CARTAO_A = 104;
const PASSO_X = CARTAO_L + 18;
const PASSO_Y = CARTAO_A + 72;

export function rotuloAnos(nascimento: number | null, falecimento: number | null): string {
  if (nascimento && falecimento) return `${nascimento} - ${falecimento}`;
  if (nascimento) return `nasceu em ${nascimento}`;
  if (falecimento) return `partiu em ${falecimento}`;
  return '';
}

export function desenharArvore(ids: number[], vinculos: VinculoDesenho[]): DesenhoArvore {
  if (!ids.length) return { cartoes: [], linhas: [], largura: 280, altura: 1 };
  const pais = new Map<number, number[]>();
  const conjuges = new Map<number, number[]>();
  for (const id of ids) {
    pais.set(id, []);
    conjuges.set(id, []);
  }
  for (const v of vinculos) {
    const doFilho = pais.get(v.pessoa_id);
    const doParente = pais.get(v.parente_id);
    if (!doFilho || !doParente) continue;
    if (v.tipo === 'pai_mae') doFilho.push(v.parente_id);
    else {
      conjuges.get(v.pessoa_id)?.push(v.parente_id);
      conjuges.get(v.parente_id)?.push(v.pessoa_id);
    }
  }
  const geracao = new Map<number, number>(ids.map((id) => [id, 0]));
  const limite = Math.max(ids.length, 1);
  for (let passo = 0; passo < limite * 2 + 2; passo++) {
    let mudou = false;
    for (const id of ids) {
      let g = 0;
      for (const p of pais.get(id) ?? []) g = Math.max(g, (geracao.get(p) ?? 0) + 1);
      if (g > limite) g = limite;
      if (g !== geracao.get(id)) { geracao.set(id, g); mudou = true; }
    }
    for (const id of ids) {
      let g = geracao.get(id) ?? 0;
      for (const s of conjuges.get(id) ?? []) g = Math.max(g, geracao.get(s) ?? 0);
      if (g > limite) g = limite;
      if (g !== geracao.get(id)) { geracao.set(id, g); mudou = true; }
    }
    if (!mudou) break;
  }
  const usadas = [...new Set(geracao.values())].sort((a, b) => a - b);
  const compacta = new Map(usadas.map((g, i) => [g, i]));
  for (const id of ids) geracao.set(id, compacta.get(geracao.get(id) ?? 0) ?? 0);

  const porGeracao = new Map<number, number[]>();
  for (const id of ids) {
    const g = geracao.get(id) ?? 0;
    const lista = porGeracao.get(g) ?? [];
    lista.push(id);
    porGeracao.set(g, lista);
  }
  const pos = new Map<number, number>();
  for (const g of [...porGeracao.keys()].sort((a, b) => a - b)) {
    const pessoas = [...(porGeracao.get(g) ?? [])].sort((a, b) => a - b);
    const visto = new Set<number>();
    const unidades: number[][] = [];
    for (const id of pessoas) {
      if (visto.has(id)) continue;
      const unidade: number[] = [];
      const fila = [id];
      visto.add(id);
      while (fila.length) {
        const atual = fila.shift();
        if (atual == null) break;
        unidade.push(atual);
        for (const s of conjuges.get(atual) ?? []) {
          if ((geracao.get(s) ?? -1) === g && !visto.has(s)) {
            visto.add(s);
            fila.push(s);
          }
        }
      }
      unidades.push(unidade);
    }
    const ordenadas = unidades.map((unidade) => {
      const xs: number[] = [];
      for (const id of unidade) {
        for (const p of pais.get(id) ?? []) {
          const xp = pos.get(p);
          if (xp != null) xs.push(xp);
        }
      }
      const media = xs.length ? xs.reduce((soma, valor) => soma + valor, 0) / xs.length : Number.POSITIVE_INFINITY;
      return { unidade, media };
    }).sort((a, b) => a.media - b.media || (a.unidade[0] ?? 0) - (b.unidade[0] ?? 0));
    let cursor = 0;
    for (const item of ordenadas) {
      const largura = Math.max(item.unidade.length - 1, 0);
      let inicio = Number.isFinite(item.media) ? item.media - largura / 2 : cursor;
      if (inicio < cursor) inicio = cursor;
      item.unidade.forEach((id, indice) => pos.set(id, inicio + indice));
      cursor = inicio + item.unidade.length + 0.65;
    }
  }
  const cartoes = ids.map((id) => ({
    id,
    esquerda: (pos.get(id) ?? 0) * PASSO_X,
    topo: (geracao.get(id) ?? 0) * PASSO_Y,
  }));
  const linhas: Linha[] = [];
  for (const v of vinculos) {
    const a = pos.get(v.pessoa_id);
    const b = pos.get(v.parente_id);
    if (a == null || b == null) continue;
    const ga = geracao.get(v.pessoa_id) ?? 0;
    const gb = geracao.get(v.parente_id) ?? 0;
    if (v.tipo === 'conjuge') {
      const esquerda = Math.min(a, b);
      const direita = Math.max(a, b);
      const y = ((ga + gb) / 2) * PASSO_Y + CARTAO_A / 2;
      linhas.push({ x1: esquerda * PASSO_X + CARTAO_L, y1: y, x2: direita * PASSO_X, y2: y });
    } else {
      linhas.push({
        x1: b * PASSO_X + CARTAO_L / 2,
        y1: gb * PASSO_Y + CARTAO_A,
        x2: a * PASSO_X + CARTAO_L / 2,
        y2: ga * PASSO_Y,
      });
    }
  }
  const largura = Math.max(280, ...cartoes.map((c) => c.esquerda + CARTAO_L)) + 8;
  const altura = Math.max(CARTAO_A, ...cartoes.map((c) => c.topo + CARTAO_A)) + 8;
  return { cartoes, linhas, largura, altura };
}
