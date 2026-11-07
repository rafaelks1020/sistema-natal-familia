/** Nível de dificuldade gravado em detalhes da nota (ausente em notas antigas e fora do modo estúdio). */
export type NivelNota = 'facil' | 'normal' | 'dificil';
export const ROTULO_NIVEL: Readonly<Record<NivelNota, string>> = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil' };

/** Contrato do placar: uma apresentação por item, incluindo o dueto quando existir. */
export type Apresentacao = {
  id: number;
  user_id: number;
  nome: string;
  dueto_user_id?: number | null;
  dueto_nome?: string | null;
  musica_id: string;
  titulo: string;
  nota: number;
  iniciado_em: string | null;
  detalhes?: { maiorCombo?: number; dificuldade?: number; nivel?: NivelNota } | null;
};

/** nivel: o da melhor nota (null quando a nota não tem nível gravado). */
export type PessoaPlacar = { user_id: number; nome: string; melhor: number; media: number; cantadas: number; nivel: NivelNota | null };
export type MusicaPlacar = { musica_id: string; titulo: string; melhor: number; cantadas: number; user_id: number; nome: string; dueto_nome: string | null };
export type Premio = { id: 'voz' | 'animado' | 'corajoso' | 'combo' | 'revelacao'; titulo: string; user_id: number; nome: string; motivo: string; valor: number };
/** ranking: notas Normal e Difícil (e sem nível); facil: melhores notas do Fácil, numa linha separada. */
export type PlacarNoite = { ano: number; ranking: PessoaPlacar[]; facil: PessoaPlacar[]; musicas: MusicaPlacar[]; apresentacoes: Apresentacao[]; premios: Premio[] };

function instante(a: Apresentacao): number {
  const t = a.iniciado_em ? Date.parse(a.iniciado_em) : NaN;
  return Number.isFinite(t) ? t : Infinity;
}

function ordenar(apresentacoes: readonly Apresentacao[]): Apresentacao[] {
  const ids = new Set<number>();
  return [...apresentacoes].filter((a) => {
    if (!Number.isFinite(a.nota) || a.nota < 0 || a.nota > 100 || ids.has(a.id)) return false;
    ids.add(a.id);
    return true;
  }).sort((a, b) => (instante(a) - instante(b) || a.id - b.id));
}

function participantes(a: Apresentacao): { user_id: number; nome: string }[] {
  const pessoas = [{ user_id: a.user_id, nome: a.nome }];
  if (a.dueto_user_id != null && a.dueto_user_id !== a.user_id) {
    pessoas.push({ user_id: a.dueto_user_id, nome: a.dueto_nome || 'Participante do dueto' });
  }
  return pessoas;
}

function nivelDe(a: Apresentacao): NivelNota | null {
  const n = a.detalhes?.nivel;
  return n === 'facil' || n === 'normal' || n === 'dificil' ? n : null;
}

/** Notas que valem no ranking principal e no Voz de anjo: tudo menos o Fácil. Se a noite só teve Fácil, vale tudo. */
function principais(feitas: readonly Apresentacao[]): { lista: Apresentacao[]; soFacil: boolean } {
  const lista = feitas.filter((a) => nivelDe(a) !== 'facil');
  return lista.length ? { lista, soFacil: false } : { lista: [...feitas], soFacil: true };
}

function melhorDe(feitas: readonly Apresentacao[]): Apresentacao {
  return feitas.reduce((m, a) => (a.nota > m.nota ? a : m));
}

function porPessoa(apresentacoes: readonly Apresentacao[]) {
  const pessoas = new Map<number, { user_id: number; nome: string; feitas: Apresentacao[] }>();
  for (const a of apresentacoes) {
    for (const pessoa of participantes(a)) {
      const p = pessoas.get(pessoa.user_id) ?? { ...pessoa, feitas: [] };
      p.feitas.push(a);
      pessoas.set(p.user_id, p);
    }
  }
  return [...pessoas.values()].sort((a, b) => a.user_id - b.user_id);
}

/** Empates são distribuídos por associação máxima. Só repete se nenhum vencedor elegível puder ocupar outro prêmio. */
export function selecionarPremios(apresentacoes: readonly Apresentacao[]): Premio[] {
  const feitas = ordenar(apresentacoes);
  const pessoas = porPessoa(feitas);
  if (!pessoas.length) return [];
  const categorias: Premio[][] = [];
  const categoria = (id: Premio['id'], titulo: string, candidatos: { user_id: number; nome: string; valor: number; motivo: string }[]) => {
    if (!candidatos.length) return;
    const max = Math.max(...candidatos.map((p) => p.valor));
    categorias.push(candidatos.filter((p) => p.valor === max).map((p) => ({ ...p, id, titulo })));
  };
  categoria('voz', 'Voz de anjo', porPessoa(principais(feitas).lista).map((p) => {
    const melhor = melhorDe(p.feitas);
    const nivel = nivelDe(melhor);
    return { ...p, valor: melhor.nota, motivo: `${melhor.nota} pontos na melhor apresentação${nivel ? ` (${ROTULO_NIVEL[nivel]})` : ''}` };
  }));
  categoria('animado', 'Mais animado', pessoas.map((p) => ({ ...p, valor: p.feitas.length, motivo: `${p.feitas.length} ${p.feitas.length === 1 ? 'música cantada' : 'músicas cantadas'}` })));
  const comDificuldade = feitas.filter((a) => typeof a.detalhes?.dificuldade === 'number' && Number.isFinite(a.detalhes.dificuldade));
  const dificuldade = comDificuldade.length ? Math.max(...comDificuldade.map((a) => a.detalhes!.dificuldade!)) : null;
  const corajosas = dificuldade == null ? [feitas[0]] : comDificuldade.filter((a) => a.detalhes!.dificuldade === dificuldade);
  categoria('corajoso', 'Corajoso da noite', corajosas.flatMap((a) => participantes(a).map((p) => ({ ...p, valor: dificuldade ?? 0, motivo: dificuldade == null ? `Abriu a noite com ${a.titulo}` : `Encarou a música mais difícil: ${a.titulo}` }))));
  categoria('combo', 'Rei/Rainha do combo', pessoas.flatMap((p) => {
    const combos = p.feitas.map((a) => a.detalhes?.maiorCombo).filter((c): c is number => typeof c === 'number' && Number.isFinite(c) && c > 0);
    if (!combos.length) return [];
    const valor = Math.max(...combos);
    return [{ ...p, valor, motivo: `Combo de ${valor}x` }];
  }));
  categoria('revelacao', 'Revelação', pessoas.flatMap((p) => {
    const valor = Math.max(...p.feitas.map((a) => a.nota)) - p.feitas[0].nota;
    return p.feitas.length > 1 && valor > 0 ? [{ ...p, valor, motivo: `Subiu ${valor} pontos desde a primeira música` }] : [];
  }));
  const donos = new Map<number, number>();
  const escolhas = new Map<number, Premio>();
  function distribuir(indice: number, vistos: Set<number>): boolean {
    for (const premio of categorias[indice]) {
      if (vistos.has(premio.user_id)) continue;
      vistos.add(premio.user_id);
      const dono = donos.get(premio.user_id);
      if (dono == null || distribuir(dono, vistos)) {
        donos.set(premio.user_id, indice);
        escolhas.set(indice, premio);
        return true;
      }
    }
    return false;
  }
  categorias.forEach((_, i) => distribuir(i, new Set()));
  return categorias.map((c, i) => {
    const p = escolhas.get(i) ?? c[0];
    return { id: p.id, titulo: p.titulo, user_id: p.user_id, nome: p.nome, motivo: p.motivo, valor: p.valor };
  });
}

/** A mesma apresentação conta uma vez para cada integrante do dueto e uma vez para a música. */
export function montarPlacar(apresentacoes: readonly Apresentacao[], ano: number): PlacarNoite {
  const feitas = ordenar(apresentacoes);
  const rankear = (lista: readonly Apresentacao[]) => porPessoa(lista).map((p): PessoaPlacar => ({
    user_id: p.user_id, nome: p.nome, cantadas: p.feitas.length,
    melhor: Math.max(...p.feitas.map((a) => a.nota)),
    media: Math.round(p.feitas.reduce((s, a) => s + a.nota, 0) / p.feitas.length),
    nivel: nivelDe(melhorDe(p.feitas)),
  })).sort((a, b) => b.melhor - a.melhor || b.media - a.media || b.cantadas - a.cantadas || a.user_id - b.user_id);
  const { lista, soFacil } = principais(feitas);
  const ranking = rankear(lista);
  const facil = soFacil ? [] : rankear(feitas.filter((a) => nivelDe(a) === 'facil'));
  const musicas = new Map<string, MusicaPlacar>();
  for (const a of feitas) {
    const anterior = musicas.get(a.musica_id);
    const melhor = !anterior || a.nota > anterior.melhor ? { musica_id: a.musica_id, titulo: a.titulo, melhor: a.nota, user_id: a.user_id, nome: a.nome, dueto_nome: a.dueto_nome ?? null } : anterior;
    musicas.set(a.musica_id, { ...melhor, cantadas: (anterior?.cantadas ?? 0) + 1 });
  }
  return { ano, ranking, facil, musicas: [...musicas.values()].sort((a, b) => b.melhor - a.melhor || a.musica_id.localeCompare(b.musica_id)), apresentacoes: feitas, premios: selecionarPremios(feitas) };
}
