// Regras puras de pontuação, tetos diários/totais, multiplicadores do karaokê, datas da edição e visibilidade do ranking.
// Sem importações de banco ou servidor para permitir testes unitários diretos com node:test.

import type {
  ConfigGamificacao,
  DiaExtrato,
  Lancamento,
  LinhaRanking,
  NivelConquista,
  Origem,
  RegraVista,
} from './tipos';

export const FUSO_SP = 'America/Sao_Paulo';
export const MAX_MUSICAS_KARAOKE_DIA = 10;

export const PONTOS_NIVEL_CONQUISTA: Readonly<Record<NivelConquista, number>> = {
  bronze: 20,
  prata: 50,
  ouro: 100,
  lendaria: 250,
};

export const REGRAS_VISTAS: RegraVista[] = [
  { regra: 'visita', origem: 'uso', titulo: 'Abrir o aplicativo no dia', pontos: '5', teto: '1 por dia' },
  { regra: 'post', origem: 'uso', titulo: 'Publicação no mural (10+ letras ou foto)', pontos: '5', teto: '3 por dia' },
  { regra: 'foto_album', origem: 'uso', titulo: 'Foto enviada para o álbum da família', pontos: '3', teto: '5 por dia' },
  { regra: 'comentario', origem: 'uso', titulo: 'Comentário no mural (3+ letras)', pontos: '2', teto: '10 por dia' },
  { regra: 'reacao', origem: 'uso', titulo: 'Curtida ou reação dada em post de parente', pontos: '1', teto: '10 por dia' },
  { regra: 'advento', origem: 'uso', titulo: 'Responder janela do Calendário do Advento', pontos: '15', teto: '1 por janela' },
  { regra: 'advento_voto', origem: 'uso', titulo: 'Votar em enquete do Advento', pontos: '2', teto: '5 por dia' },
  { regra: 'presenca', origem: 'uso', titulo: 'Confirmar presença na ceia', pontos: '30', teto: '1 na edição' },
  { regra: 'receita', origem: 'uso', titulo: 'Compartilhar receita de família', pontos: '20', teto: '3 na edição' },
  { regra: 'historia', origem: 'uso', titulo: 'Gravar história da família', pontos: '20', teto: '3 na edição' },
  { regra: 'capsula', origem: 'uso', titulo: 'Lacrar cápsula do tempo', pontos: '20', teto: '3 na edição' },
  { regra: 'homenagem', origem: 'uso', titulo: 'Publicar homenagem no memorial', pontos: '15', teto: '3 na edição' },
  { regra: 'desejo', origem: 'uso', titulo: 'Adicionar item na lista de desejos', pontos: '5', teto: '5 na edição' },
  { regra: 'arvore', origem: 'uso', titulo: 'Adicionar pessoa na árvore genealógica', pontos: '3', teto: '20 na edição' },
  { regra: 'quiz_acerto', origem: 'brincadeira', titulo: 'Acertar pergunta do Quiz da Família', pontos: '5', teto: null },
  { regra: 'quiz_podio', origem: 'brincadeira', titulo: 'Pódio final do Quiz (1º / 2º / 3º)', pontos: '50 / 30 / 20', teto: '1 na edição' },
  { regra: 'bingo', origem: 'brincadeira', titulo: 'Bingo da Ceia confirmado', pontos: '40', teto: null },
  { regra: 'desafio_foto', origem: 'brincadeira', titulo: 'Enviar foto em Desafio de Fotos', pontos: '10', teto: '1 por desafio' },
  { regra: 'desafio_vencedor', origem: 'brincadeira', titulo: 'Foto mais votada do Desafio', pontos: '40', teto: null },
  { regra: 'enquete', origem: 'brincadeira', titulo: 'Votar em enquete ao vivo ou do mural', pontos: '2', teto: '1 por enquete' },
  { regra: 'jogo_festa', origem: 'brincadeira', titulo: 'Jogos da festa (participar / vencer)', pontos: '5 / 30', teto: null },
  { regra: 'karaoke', origem: 'karaoke', titulo: 'Cantar no karaokê (Fácil x0,5, Normal x1, Difícil x1,2)', pontos: 'nota ajustada', teto: 'melhor nota por música, até 10 por dia' },
  { regra: 'karaoke_dueto', origem: 'karaoke', titulo: 'Dueto no karaokê (os dois recebem a nota)', pontos: 'nota ajustada', teto: 'conta no limite de 10 por dia' },
  { regra: 'karaoke_batalha', origem: 'karaoke', titulo: 'Vencer uma batalha de karaokê', pontos: '30', teto: null },
  { regra: 'missao', origem: 'missao', titulo: 'Cumprir missão relâmpago dentro do prazo', pontos: '20 a 80', teto: '1 por missão' },
  { regra: 'conquista', origem: 'conquista', titulo: 'Desbloquear conquista (Bronze / Prata / Ouro / Lendária)', pontos: '20 / 50 / 100 / 250', teto: 'conquistas de dinheiro valem 0' },
  { regra: 'ajuste', origem: 'ajuste', titulo: 'Ajuste manual da organização (com motivo no extrato)', pontos: 'variável', teto: null },
];

const formatadorDiaSP = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_SP,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const formatadorCurtoSP = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_SP,
  day: '2-digit',
  month: '2-digit',
});

export function diaSPDeISO(valor: string | Date): string {
  const d = valor instanceof Date ? valor : new Date(valor);
  if (!Number.isFinite(d.getTime())) return '1970-01-01';
  return formatadorDiaSP.format(d);
}

export function curtoDataSP(valor: string | Date): string {
  const d = valor instanceof Date ? valor : new Date(valor);
  if (!Number.isFinite(d.getTime())) return '00/00';
  return formatadorCurtoSP.format(d);
}

/** Início oficial da edição: 01/11 às 00:00 de São Paulo. */
export function inicioEdicaoISO(ano: number): string {
  return new Date(`${ano}-11-01T00:00:00-03:00`).toISOString();
}

/** Configuração padrão quando não há linha salva em gami_config. */
export function configPadrao(ano: number, excluidosPadrao: readonly number[] = []): ConfigGamificacao {
  const encerra = new Date(`${ano}-12-24T22:00:00-03:00`);
  const oculto = new Date(encerra.getTime() - 48 * 60 * 60 * 1000);
  return {
    ano,
    encerra_em: encerra.toISOString(),
    ranking_oculto_em: oculto.toISOString(),
    revelado_em: null,
    missoes_surpresa: true,
    excluidos: [...new Set(excluidosPadrao.filter((id) => Number.isInteger(id) && id > 0))],
  };
}

/** O ranking fica oculto entre ranking_oculto_em e o momento em que o admin revela no telão. */
export function rankingEstaOculto(
  config: Pick<ConfigGamificacao, 'ranking_oculto_em' | 'revelado_em'>,
  agora: Date = new Date(),
): boolean {
  if (config.revelado_em) return false;
  const ocultoMs = Date.parse(config.ranking_oculto_em);
  if (!Number.isFinite(ocultoMs)) return false;
  return agora.getTime() >= ocultoMs;
}

export function edicaoEncerrada(
  config: Pick<ConfigGamificacao, 'encerra_em'>,
  agora: Date = new Date(),
): boolean {
  const encerraMs = Date.parse(config.encerra_em);
  if (!Number.isFinite(encerraMs)) return false;
  return agora.getTime() > encerraMs;
}

export function contarLetrasUteis(texto: string | null | undefined): number {
  if (!texto) return 0;
  const limpo = texto.trim().replace(/\s+/g, ' ');
  return [...limpo].length;
}

export function postValidoParaPontos(texto: string | null | undefined, temFoto: boolean): boolean {
  return temFoto || contarLetrasUteis(texto) >= 10;
}

export function comentarioValidoParaPontos(texto: string | null | undefined): boolean {
  return contarLetrasUteis(texto) >= 3;
}

export type NivelKaraoke = 'facil' | 'normal' | 'dificil';

export function pontosKaraokeApresentacao(nota: number, nivel?: string | null): number {
  if (!Number.isFinite(nota) || nota < 0 || nota > 100) return 0;
  if (nivel === 'dificil') return Math.round(nota * 1.2);
  if (nivel === 'facil') return Math.round(nota * 0.5);
  return Math.round(nota);
}

export interface FatoBruto {
  user_id: number;
  origem: Exclude<Origem, 'conquista' | 'ajuste'>;
  regra: string;
  ref: string;
  pontos: number;
  descricao: string;
  ocorreu_em: string;
}

export interface FatoKaraoke {
  id: number | string;
  user_id: number;
  dueto_user_id?: number | null;
  musica_id: string;
  titulo: string;
  nota: number;
  nivel?: string | null;
  ocorreu_em: string;
}

export interface LancamentoGerado {
  user_id: number;
  origem: Origem;
  regra: string;
  ref: string;
  pontos: number;
  descricao: string;
  ocorreu_em: string;
}

type TetoRegra = { porDia?: number; total?: number };

const TETOS_POR_REGRA: Readonly<Record<string, TetoRegra>> = {
  visita: { porDia: 1 },
  post: { porDia: 3 },
  foto_album: { porDia: 5 },
  comentario: { porDia: 10 },
  reacao: { porDia: 10 },
  advento_voto: { porDia: 5 },
  presenca: { total: 1 },
  receita: { total: 3 },
  historia: { total: 3 },
  capsula: { total: 3 },
  homenagem: { total: 3 },
  desejo: { total: 5 },
  arvore: { total: 20 },
};

function foiAnulado(
  anulados: ReadonlyMap<number, ReadonlySet<string>> | undefined,
  userId: number,
  regra: string,
  ref: string,
): boolean {
  const set = anulados?.get(userId);
  if (!set || set.size === 0) return false;
  return set.has(`${regra}|${ref}`) || set.has(ref);
}

export interface JanelaPontuacao {
  ano: number;
  inicio_em?: string;
  encerra_em: string;
  anulados?: ReadonlyMap<number, ReadonlySet<string>>;
}

/** Aplica corte temporal (inicio_em .. encerra_em), anulações do admin, unicidade e tetos por dia/edição. */
export function aplicarTetosFatos(fatos: readonly FatoBruto[], janela: JanelaPontuacao): LancamentoGerado[] {
  const inicioMs = Date.parse(janela.inicio_em ?? inicioEdicaoISO(janela.ano));
  const encerraMs = Date.parse(janela.encerra_em);

  const candidatos = fatos
    .map((f) => ({ f, ms: Date.parse(f.ocorreu_em) }))
    .filter(({ f, ms }) => (
      Number.isInteger(f.user_id)
      && f.user_id > 0
      && Number.isFinite(ms)
      && ms >= inicioMs
      && ms <= encerraMs
      && Number.isInteger(f.pontos)
      && f.pontos !== 0
      && !foiAnulado(janela.anulados, f.user_id, f.regra, f.ref)
    ))
    .sort((a, b) => (
      a.ms - b.ms
      || a.f.user_id - b.f.user_id
      || a.f.regra.localeCompare(b.f.regra)
      || a.f.ref.localeCompare(b.f.ref)
    ));

  const vistosUnicos = new Set<string>();
  const contagemDia = new Map<string, number>();
  const contagemTotal = new Map<string, number>();
  const saida: LancamentoGerado[] = [];

  for (const { f, ms } of candidatos) {
    const chaveUnica = `${f.user_id}|${f.regra}|${f.ref}`;
    if (vistosUnicos.has(chaveUnica)) continue;

    const teto = TETOS_POR_REGRA[f.regra];
    if (teto?.total != null) {
      const chaveTotal = `${f.user_id}|${f.regra}`;
      const atual = contagemTotal.get(chaveTotal) ?? 0;
      if (atual >= teto.total) continue;
      contagemTotal.set(chaveTotal, atual + 1);
    }

    if (teto?.porDia != null) {
      const dia = diaSPDeISO(new Date(ms));
      const chaveDia = `${f.user_id}|${f.regra}|${dia}`;
      const atualDia = contagemDia.get(chaveDia) ?? 0;
      if (atualDia >= teto.porDia) {
        if (teto.total != null) {
          const chaveTotal = `${f.user_id}|${f.regra}`;
          contagemTotal.set(chaveTotal, (contagemTotal.get(chaveTotal) ?? 1) - 1);
        }
        continue;
      }
      contagemDia.set(chaveDia, atualDia + 1);
    }

    vistosUnicos.add(chaveUnica);
    saida.push({
      user_id: f.user_id,
      origem: f.origem,
      regra: f.regra,
      ref: f.ref,
      pontos: f.pontos,
      descricao: f.descricao,
      ocorreu_em: new Date(ms).toISOString(),
    });
  }

  return saida;
}

const ROTULO_NIVEL_KARAOKE: Readonly<Record<string, string>> = {
  facil: 'Fácil',
  normal: 'Normal',
  dificil: 'Difícil',
};

/**
 * Pontua apresentações de karaokê:
 * - Os dois integrantes do dueto recebem a nota.
 * - Aplica multiplicador de nível (Fácil x0,5, Normal x1, Difícil x1,2, arredondado).
 * - Mantém apenas a MELHOR pontuação de cada música por pessoa na edição.
 * - Limita a no máximo 10 músicas pontuadas por pessoa por dia de São Paulo (as 10 maiores do dia).
 */
export function calcularLancamentosKaraoke(
  apresentacoes: readonly FatoKaraoke[],
  janela: JanelaPontuacao,
): LancamentoGerado[] {
  const inicioMs = Date.parse(janela.inicio_em ?? inicioEdicaoISO(janela.ano));
  const encerraMs = Date.parse(janela.encerra_em);

  type ItemExpandido = {
    idStr: string;
    user_id: number;
    ehDueto: boolean;
    musica_id: string;
    titulo: string;
    nota: number;
    pontos: number;
    nivel: string | null;
    ms: number;
  };

  const expandidos: ItemExpandido[] = [];
  const idsVistos = new Set<string>();

  for (const ap of apresentacoes) {
    const idStr = String(ap.id);
    if (!ap.musica_id || idsVistos.has(idStr)) continue;
    idsVistos.add(idStr);

    const ms = Date.parse(ap.ocorreu_em);
    if (!Number.isFinite(ms) || ms < inicioMs || ms > encerraMs) continue;
    if (!Number.isFinite(ap.nota) || ap.nota < 0 || ap.nota > 100) continue;

    const pontos = pontosKaraokeApresentacao(ap.nota, ap.nivel);
    if (pontos <= 0) continue;

    const temDueto = ap.dueto_user_id != null && ap.dueto_user_id > 0 && ap.dueto_user_id !== ap.user_id;
    const participantes = temDueto ? [ap.user_id, ap.dueto_user_id!] : [ap.user_id];

    for (const uid of participantes) {
      if (!Number.isInteger(uid) || uid <= 0) continue;
      const regra = temDueto ? 'karaoke_dueto' : 'karaoke';
      const ref = `musica:${ap.musica_id}`;
      const refFila = `fila:${idStr}`;
      if (
        foiAnulado(janela.anulados, uid, regra, ref)
        || foiAnulado(janela.anulados, uid, 'karaoke', ref)
        || foiAnulado(janela.anulados, uid, regra, refFila)
        || foiAnulado(janela.anulados, uid, 'karaoke', refFila)
      ) {
        continue;
      }
      expandidos.push({
        idStr,
        user_id: uid,
        ehDueto: temDueto,
        musica_id: ap.musica_id,
        titulo: ap.titulo || 'Música',
        nota: ap.nota,
        pontos,
        nivel: ap.nivel ?? null,
        ms,
      });
    }
  }

  // 1) Melhor nota de cada música por pessoa na edição.
  const melhorPorMusica = new Map<string, ItemExpandido>();
  for (const item of expandidos) {
    const chave = `${item.user_id}|${item.musica_id}`;
    const atual = melhorPorMusica.get(chave);
    if (
      !atual
      || item.pontos > atual.pontos
      || (item.pontos === atual.pontos && item.nota > atual.nota)
      || (item.pontos === atual.pontos && item.nota === atual.nota && item.ms < atual.ms)
      || (item.pontos === atual.pontos && item.nota === atual.nota && item.ms === atual.ms && item.idStr.localeCompare(atual.idStr) < 0)
    ) {
      melhorPorMusica.set(chave, item);
    }
  }

  // 2) No máximo 10 músicas pontuadas por dia de São Paulo por pessoa.
  const porPessoaDia = new Map<string, ItemExpandido[]>();
  for (const item of melhorPorMusica.values()) {
    const dia = diaSPDeISO(new Date(item.ms));
    const chaveDia = `${item.user_id}|${dia}`;
    const lista = porPessoaDia.get(chaveDia) ?? [];
    lista.push(item);
    porPessoaDia.set(chaveDia, lista);
  }

  const escolhidos: ItemExpandido[] = [];
  for (const lista of porPessoaDia.values()) {
    lista.sort((a, b) => (
      b.pontos - a.pontos
      || b.nota - a.nota
      || a.ms - b.ms
      || a.idStr.localeCompare(b.idStr)
    ));
    escolhidos.push(...lista.slice(0, MAX_MUSICAS_KARAOKE_DIA));
  }

  escolhidos.sort((a, b) => a.ms - b.ms || a.user_id - b.user_id || a.idStr.localeCompare(b.idStr));

  return escolhidos.map((item): LancamentoGerado => {
    const rotuloNivel = item.nivel && ROTULO_NIVEL_KARAOKE[item.nivel] ? `, ${ROTULO_NIVEL_KARAOKE[item.nivel]}` : '';
    const prefixo = item.ehDueto ? 'Karaokê em dueto' : 'Karaokê';
    const tituloCurto = item.titulo.length > 60 ? `${item.titulo.slice(0, 57)}...` : item.titulo;
    return {
      user_id: item.user_id,
      origem: 'karaoke',
      regra: item.ehDueto ? 'karaoke_dueto' : 'karaoke',
      ref: `musica:${item.musica_id}`,
      pontos: item.pontos,
      descricao: `${prefixo}: ${tituloCurto} (nota ${item.nota}${rotuloNivel})`,
      ocorreu_em: new Date(item.ms).toISOString(),
    };
  });
}

export function somarPorOrigem(lancamentos: readonly Pick<Lancamento, 'origem' | 'pontos'>[]): Record<Origem, number> {
  const base: Record<Origem, number> = {
    uso: 0,
    brincadeira: 0,
    karaoke: 0,
    conquista: 0,
    missao: 0,
    ajuste: 0,
  };
  for (const l of lancamentos) {
    if (l.origem in base) base[l.origem] += l.pontos;
  }
  return base;
}

export function agruparExtratoPorDia<T extends Lancamento>(lancamentos: readonly T[]): DiaExtrato[] {
  const ordenado = [...lancamentos].sort((a, b) => Date.parse(b.ocorreu_em) - Date.parse(a.ocorreu_em));
  const mapa = new Map<string, { total: number; lancamentos: T[] }>();

  for (const l of ordenado) {
    const dia = diaSPDeISO(l.ocorreu_em);
    const grupo = mapa.get(dia) ?? { total: 0, lancamentos: [] };
    grupo.total += l.pontos;
    grupo.lancamentos.push(l);
    mapa.set(dia, grupo);
  }

  return [...mapa.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dia, g]) => ({
      dia,
      total: g.total,
      lancamentos: g.lancamentos,
    }));
}

export function montarRanking(
  usuarios: readonly { id: number; nome: string; avatar_url: string | null }[],
  totaisPorUser: ReadonlyMap<number, number>,
  conquistasPorUser: ReadonlyMap<number, number>,
  excluidos?: ReadonlySet<number> | readonly number[],
): LinhaRanking[] {
  const setExcluidos = excluidos instanceof Set
    ? excluidos
    : new Set(Array.isArray(excluidos) ? excluidos : []);

  const linhas = usuarios
    .filter((u) => !setExcluidos.has(u.id))
    .map((u) => ({
      posicao: 0,
      user_id: u.id,
      nome: u.nome,
      avatar_url: u.avatar_url,
      total: totaisPorUser.get(u.id) ?? 0,
      conquistas: conquistasPorUser.get(u.id) ?? 0,
    }));

  linhas.sort((a, b) => (
    b.total - a.total
    || b.conquistas - a.conquistas
    || a.nome.localeCompare(b.nome, 'pt-BR')
    || a.user_id - b.user_id
  ));

  return linhas.map((l, idx) => ({ ...l, posicao: idx + 1 }));
}
