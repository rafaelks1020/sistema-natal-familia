import type { CategoriaConquista, ConquistaVista, NivelConquista } from '../../types/pontos';

export const ORDEM_CATEGORIAS: CategoriaConquista[] = ['familia', 'fotografo', 'prosa', 'advento', 'ceia', 'festa', 'karaoke', 'generoso', 'memorias', 'secretas'];
export const ROTULOS_CATEGORIA: Record<CategoriaConquista, string> = {
  familia: 'Família', fotografo: 'Fotógrafo', prosa: 'Prosa e mural', advento: 'Advento', ceia: 'A ceia',
  festa: 'Noite de festa', karaoke: 'Karaokê', generoso: 'Generosidade', memorias: 'Memórias', secretas: 'Secretas',
};
export const ROTULOS_NIVEL: Record<NivelConquista, string> = { bronze: 'Bronze', prata: 'Prata', ouro: 'Ouro', lendaria: 'Lendária' };

function proporcao(c: ConquistaVista): number {
  return c.progresso && c.progresso.meta > 0 ? c.progresso.atual / c.progresso.meta : 0;
}

/** As 5 conquistas mais perto de sair: maior progresso primeiro; completa com as de menor meta. */
export function faltaPouco(conquistas: readonly ConquistaVista[], quantas = 5): ConquistaVista[] {
  const abertas = conquistas.filter((c) => !c.ganha_em && !c.secreta);
  const andando = abertas.filter((c) => c.progresso && c.progresso.atual > 0).sort((a, b) => proporcao(b) - proporcao(a)).slice(0, quantas);
  if (andando.length >= quantas) return andando;
  const usados = new Set(andando.map((c) => c.id));
  const resto = abertas.filter((c) => !usados.has(c.id)).sort((a, b) => (a.progresso?.meta ?? Infinity) - (b.progresso?.meta ?? Infinity));
  return [...andando, ...resto.slice(0, quantas - andando.length)];
}

/** Da mais recente para a mais antiga. */
export function jaConquistadas(conquistas: readonly ConquistaVista[]): ConquistaVista[] {
  return conquistas.filter((c) => c.ganha_em).sort((a, b) => new Date(b.ganha_em ?? 0).getTime() - new Date(a.ganha_em ?? 0).getTime());
}

export function agruparPorCategoria(conquistas: readonly ConquistaVista[]): { categoria: CategoriaConquista; titulo: string; ganhas: number; itens: ConquistaVista[] }[] {
  return ORDEM_CATEGORIAS.flatMap((categoria) => {
    const itens = conquistas.filter((c) => c.categoria === categoria);
    return itens.length ? [{ categoria, titulo: ROTULOS_CATEGORIA[categoria], ganhas: itens.filter((c) => c.ganha_em).length, itens }] : [];
  });
}

export function valePontos(c: ConquistaVista): string {
  return c.pontos > 0 ? `Vale ${c.pontos.toLocaleString('pt-BR')} ${c.pontos === 1 ? 'ponto' : 'pontos'}` : 'Só uma lembrança, não vale pontos';
}
