import { route, ok, requireAdmin } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { medirDificuldade } from '@/app/telao/karaoke/prova';
import { prepararNotas, type NotaEstudio } from '@/app/telao/karaoke/pontuacao';
import type { DadosEstudio } from '@/app/telao/karaoke/tipos';
import { comMigracao, semCache } from '../_dados';
export const dynamic = 'force-dynamic';
export const GET = route(comMigracao(async () => {
  await requireAdmin();
  const { rows } = await query<{ id: string; faixa: string; artista: string; notas: NotaEstudio[]; palavras: DadosEstudio['palavras'] }>(
    `SELECT id,faixa,artista,notas,palavras FROM karaoke_catalogo WHERE status = 'pronta' AND notas IS NOT NULL AND palavras IS NOT NULL AND audio_url IS NOT NULL`);
  const musicas = rows.filter((m) => prepararNotas(m.notas).length > 0).map((m) => ({ id: Number(m.id), faixa: m.faixa, artista: m.artista, dificuldade: medirDificuldade(prepararNotas(m.notas), m.palavras) }))
    .sort((a, b) => b.dificuldade.indice - a.dificuldade.indice || a.id - b.id).slice(0, 5);
  return semCache(ok({ musicas, medida: '40% extensão de notas, 30% duração das notas (percentil 90), 30% sílabas por segundo da letra (percentil 90). Sílabas estimadas por grupos vocálicos.' }));
}));
