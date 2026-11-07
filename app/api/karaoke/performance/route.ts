import { caminhoDaUrl } from '@/app/lib/arquivos';
import { route, ok, readJson, toInt, HttpError, isBlobUrl, requireAdmin, requireUser } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { performanceDestaFila } from './caminho';

export const dynamic = 'force-dynamic';

interface PerformanceRow {
  fila_id: number | string;
  video_url: string;
  titulo: string;
  faixa: string | null;
  nome: string;
  dueto_nome: string | null;
  user_id: number | string;
  dueto_user_id: number | string | null;
}

function codigoPg(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null ? (err as { code?: string }).code : undefined;
}

/** Coluna ausente: avisa para rodar a migração em vez de dar erro 500. */
function comMigracao(h: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    try { return await h(req); }
    catch (err) {
      if (codigoPg(err) === '42703') throw new HttpError(503, 'Rode a migração 045');
      throw err;
    }
  };
}

/** GET: vídeos da apresentação inteira de quem está logado (cantor ou dueto), da edição atual. Mais novos primeiro. */
export const GET = route(comMigracao(async () => {
  const me = await requireUser();
  const ano = edicaoAtual();
  const { rows } = await query<PerformanceRow>(
    `SELECT f.id AS fila_id, f.video_url, f.titulo, f.faixa, f.user_id, f.dueto_user_id, u.name AS nome, d.name AS dueto_nome
       FROM karaoke_fila f
       JOIN family_users u ON u.id = f.user_id
       LEFT JOIN family_users d ON d.id = f.dueto_user_id
      WHERE f.ano = $1 AND f.video_url IS NOT NULL AND (f.user_id = $2 OR f.dueto_user_id = $2)
      ORDER BY f.id DESC
      LIMIT 50`,
    [ano, me.id],
  );
  return ok({
    ano,
    eu: me.id,
    performances: rows.map((r) => ({
      fila_id: Number(r.fila_id),
      video_url: r.video_url,
      titulo: r.titulo,
      faixa: r.faixa,
      nome: r.nome,
      dueto_nome: r.dueto_nome,
      user_id: Number(r.user_id),
      dueto_user_id: r.dueto_user_id === null ? null : Number(r.dueto_user_id),
    })),
  });
}));

/**
 * POST (só admin, o telão): grava a URL do vídeo já enviado. Corpo: { fila_id, url }.
 * A url precisa ser do nosso armazenamento e estar em karaoke/performances/<ano>/<fila_id>-<sufixo>.webm.
 */
export const POST = route(comMigracao(async (req) => {
  await requireAdmin();
  const body = await readJson<{ fila_id?: unknown; url?: unknown }>(req);
  const filaId = toInt(body.fila_id, 'fila_id');
  if (typeof body.url !== 'string' || !isBlobUrl(body.url)) throw new HttpError(400, 'Endereço do arquivo inválido.');
  const { rows } = await query<{ ano: number }>('SELECT ano FROM karaoke_fila WHERE id = $1', [filaId]);
  const f = rows[0];
  if (!f) throw new HttpError(404, 'Música não encontrada na fila.');
  const caminho = caminhoDaUrl(body.url);
  if (!caminho || !performanceDestaFila(`/${caminho}`, f.ano, filaId)) throw new HttpError(400, 'Endereço do arquivo inválido.');
  await query('UPDATE karaoke_fila SET video_url = $1 WHERE id = $2', [body.url, filaId]);
  return ok({ fila_id: filaId });
}));
