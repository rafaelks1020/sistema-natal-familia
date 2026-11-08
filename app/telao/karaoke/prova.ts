import type { ClassificadoProva, FaseProva, TentativaProva } from './prova-tipos';
import type { LinhaEstudio } from './tipos';
import type { NotaEstudio } from './pontuacao';

/** Padrão do ranking oculto quando não há linha em gami_config: 24/12 às 22h de São Paulo menos 48h. */
export function ocultoPadrao(ano: number): Date {
  return new Date(Date.parse(`${ano}-12-24T22:00:00-03:00`) - 48 * 3600000);
}

/** O ranking fica escondido da família entre ranking_oculto_em e a revelação (revelado_em). Admin vê sempre (quem chama decide). */
export function rankingEscondido(agora: number, oculto: Date | string | null | undefined, revelado: Date | string | null | undefined, ano: number): boolean {
  if (revelado) return false;
  return agora >= +(oculto == null ? ocultoPadrao(ano) : new Date(oculto));
}

/** Tentativa anulada pela organização não ocupa a vaga, não conta na classificação e libera uma nova tentativa. */
const conta = (t: { status?: string }) => t.status !== 'anulada';

export function tentativaPermitida(tentativas: readonly (Pick<TentativaProva, 'user_id' | 'catalogo_id' | 'fase'> & Partial<Pick<TentativaProva, 'status'>>)[], pessoa: number, musica: number, fase: FaseProva): boolean {
  return !tentativas.some((t) => conta(t) && t.user_id === pessoa && t.catalogo_id === musica && t.fase === fase);
}

/** Faltas e tentativas sem nota valem zero; a afinação usa as cinco músicas, inclusive faltas. */
export function classificarEliminatoria(musicas: readonly number[], todas: readonly (Pick<TentativaProva, 'user_id' | 'catalogo_id' | 'fase' | 'nota' | 'detalhes'> & Partial<Pick<TentativaProva, 'status'>>)[], pessoas: readonly { user_id: number; nome: string; avatar_url: string | null }[]): ClassificadoProva[] {
  const tentativas = todas.filter(conta);
  return pessoas.filter((p) => tentativas.some((t) => t.user_id === p.user_id && t.fase === 'eliminatoria' && musicas.includes(t.catalogo_id))).map((p) => {
    const feitas = tentativas.filter((t) => t.user_id === p.user_id && t.fase === 'eliminatoria');
    const notas = musicas.map((id) => ({ catalogo_id: id, nota: feitas.find((t) => t.catalogo_id === id)?.nota ?? 0 }));
    const afinacao = musicas.reduce((s, id) => {
      const v = feitas.find((t) => t.catalogo_id === id)?.detalhes.afinacao;
      return s + (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    }, 0) / Math.max(1, musicas.length);
    return { ...p, posicao: 0, notas, soma_eliminatoria: notas.reduce((s, n) => s + n.nota, 0), afinacao_media: afinacao, nota_final: null };
  }).sort((a, b) => b.soma_eliminatoria - a.soma_eliminatoria || b.afinacao_media - a.afinacao_media || a.user_id - b.user_id)
    .map((p, i) => ({ ...p, posicao: i + 1 }));
}
export function escolherFinalistas(classificacao: readonly ClassificadoProva[]): ClassificadoProva[] { return classificacao.slice(0, 4); }
export function classificarFinal(finalistas: readonly ClassificadoProva[], tentativas: readonly (Pick<TentativaProva, 'user_id' | 'fase' | 'nota'> & Partial<Pick<TentativaProva, 'status'>>)[]): ClassificadoProva[] {
  return finalistas.map((p) => ({ ...p, nota_final: tentativas.find((t) => t.user_id === p.user_id && t.fase === 'final' && t.status !== 'cantando' && conta(t))?.nota ?? null }))
    .sort((a, b) => (b.nota_final ?? -1) - (a.nota_final ?? -1) || b.soma_eliminatoria - a.soma_eliminatoria || b.afinacao_media - a.afinacao_media || a.user_id - b.user_id)
    .map((p, i) => ({ ...p, posicao: i + 1 }));
}

/** Índice objetivo: 40% extensão (24 semitons), 30% duração (4 s), 30% sílabas/s (8).
 * Sílabas estimadas por grupos vocálicos da letra; percentil 90 evita uma palavra isolada dominar.
 */
export function medirDificuldade(notas: readonly NotaEstudio[], palavras: { linhas: LinhaEstudio[] } | null) {
  const validas = notas.filter((n) => Number.isFinite(n.midi) && Number.isFinite(n.dur_ms) && n.dur_ms > 0);
  const p90 = (v: number[]) => v.length ? [...v].sort((a, b) => a - b)[Math.floor((v.length - 1) * 0.9)] : 0;
  const alturas = validas.map((n) => n.midi);
  const extensao = alturas.length ? Math.max(...alturas) - Math.min(...alturas) : 0;
  const longas = p90(validas.map((n) => n.dur_ms)) / 1000;
  const velocidades = (palavras?.linhas ?? []).filter((l) => l.fim_ms > l.inicio_ms).map((l) => {
    const texto = (l.texto || l.palavras.map((p) => p.texto).join(' ')).toLowerCase();
    const silabas = texto.match(/[aeiouáéíóúâêôãõü]+/g)?.length ?? 0;
    return silabas / ((l.fim_ms - l.inicio_ms) / 1000);
  });
  const velocidade = p90(velocidades);
  const indice = Math.round(100 * (0.4 * Math.min(1, extensao / 24) + 0.3 * Math.min(1, longas / 4) + 0.3 * Math.min(1, velocidade / 8)) * 100) / 100;
  return { indice, extensao_semitons: extensao, nota_longa_p90_s: longas, silabas_por_segundo_p90: Math.round(velocidade * 100) / 100 };
}
