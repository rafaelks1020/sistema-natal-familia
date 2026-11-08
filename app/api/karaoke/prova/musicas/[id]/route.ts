import { route, ok, requireUser, toInt, HttpError } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import type { DadosEstudio } from '@/app/telao/karaoke/tipos';
import { configProva, comMigracao, semCache } from '../../_dados';
export const dynamic = 'force-dynamic';
export const GET = route(comMigracao(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const id = toInt((await ctx.params).id);
  const c = await configProva(query, edicaoAtual());
  if (!c?.musicas.includes(id)) throw new HttpError(404, 'Essa música não faz parte da Prova.');
  const { rows } = await query<DadosEstudio & { id: string; faixa: string; artista: string; duracao_ms: number }>(
    `SELECT id,faixa,artista,duracao_ms,audio_url,palavras,notas FROM karaoke_catalogo WHERE id = $1 AND status = 'pronta'`, [id]);
  if (!rows[0]) throw new HttpError(404, 'A música ainda não está pronta.');
  return semCache(ok({ ...rows[0], id: Number(rows[0].id) }));
}));
