import { route, ok, toInt, HttpError, requireUser } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { comMigracaoEstudio, musicaCatalogo, type LinhaCatalogo } from '../../_catalogo';

export const dynamic = 'force-dynamic';

type ParamsCtx = { params: Promise<{ id: string }> };

/** Palavras e notas de uma música do catálogo (só quando já está pronta). */
export const GET = route<ParamsCtx>(comMigracaoEstudio<ParamsCtx>(async (_req, { params }) => {
  await requireUser();
  const id = toInt((await params).id, 'id');
  const { rows } = await query<LinhaCatalogo & { audio_url: string | null; palavras: unknown; notas: unknown }>(
    'SELECT id, slug, artista, faixa, status, capa_url, duracao_ms, lrclib_id, audio_url, palavras, notas FROM karaoke_catalogo WHERE id = $1',
    [id],
  );
  const m = rows[0];
  if (!m) throw new HttpError(404, 'Música não encontrada.');
  if (m.status !== 'pronta') throw new HttpError(409, 'Essa música ainda não está pronta.');
  return ok({ ...musicaCatalogo(m), audio_url: m.audio_url, palavras: m.palavras, notas: m.notas });
}));
