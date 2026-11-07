import { route, ok, readJson, toInt, cleanText, isBlobUrl, HttpError, requireAdmin, requireUser } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { lerFilaParaAlbum, publicarNoAlbum } from '../_album';

export const dynamic = 'force-dynamic';

/** Melhores momentos do karaokê: fotos e clipes gravados no telão e o vídeo de melhores momentos (reel) de cada música. */

interface Momento {
  id: number | string;
  fila_id: number | string;
  user_id: number | null;
  tipo: 'foto' | 'clipe' | 'reel';
  url: string;
  ms: number | null;
  duracao_ms: number | null;
  motivo: string | null;
  created_at: string;
  titulo: string;
  faixa: string | null;
  nome: string;
  dueto_nome: string | null;
  dueto_user_id: number | null;
}

interface Reel { fila_id: number | string; reel_url: string; titulo: string; faixa: string | null; nome: string; dueto_nome: string | null; user_id: number; dueto_user_id: number | null }

function codigoPg(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null ? (err as { code?: string }).code : undefined;
}

/** Tabela ou coluna ausente: avisa para rodar a migração em vez de dar erro 500. */
function comMigracao(h: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    try {
      return await h(req);
    } catch (err) {
      const codigo = codigoPg(err);
      if (codigo === '42P01' || codigo === '42703') throw new HttpError(503, 'Rode a migração 042');
      throw err;
    }
  };
}

function inteiroOpcional(valor: unknown, min: number, max: number, campo: string): number | null {
  if (valor == null || valor === '') return null;
  const n = Number(valor);
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, `Campo ${campo} inválido.`);
  return Math.round(n);
}

/** GET ?fila_id=N (uma música), ?minhas=1 (as minhas, como cantor ou dueto) ou sem filtro (a noite toda). Mais novos primeiro. */
export const GET = route(comMigracao(async (req) => {
  const me = await requireUser();
  const ano = edicaoAtual();
  const url = new URL(req.url);
  const filaParam = url.searchParams.get('fila_id');
  const filaId = filaParam ? toInt(filaParam, 'fila_id') : null;
  const minhas = url.searchParams.get('minhas') === '1';

  const filtro = ['f.ano = $1'];
  const params: unknown[] = [ano];
  if (filaId !== null) { params.push(filaId); filtro.push(`f.id = $${params.length}`); }
  if (minhas) { params.push(me.id); filtro.push(`(f.user_id = $${params.length} OR f.dueto_user_id = $${params.length})`); }
  const onde = filtro.join(' AND ');

  const [momentos, reels] = await Promise.all([
    query<Momento>(
      `SELECT m.id, m.fila_id, m.user_id, m.tipo, m.url, m.ms, m.duracao_ms, m.motivo, m.created_at,
              f.titulo, f.faixa, u.name AS nome, d.name AS dueto_nome, f.dueto_user_id
         FROM karaoke_momentos m
         JOIN karaoke_fila f ON f.id = m.fila_id
         JOIN family_users u ON u.id = f.user_id
         LEFT JOIN family_users d ON d.id = f.dueto_user_id
        WHERE m.tipo IN ('foto', 'clipe') AND ${onde}
        ORDER BY m.id DESC
        LIMIT 200`,
      params,
    ),
    query<Reel>(
      `SELECT f.id AS fila_id, f.reel_url, f.titulo, f.faixa, f.user_id, f.dueto_user_id, u.name AS nome, d.name AS dueto_nome
         FROM karaoke_fila f
         JOIN family_users u ON u.id = f.user_id
         LEFT JOIN family_users d ON d.id = f.dueto_user_id
        WHERE f.reel_status = 'pronto' AND f.reel_url IS NOT NULL AND ${onde}
        ORDER BY f.id DESC
        LIMIT 50`,
      params,
    ),
  ]);
  return ok({
    ano,
    eu: me.id,
    momentos: momentos.rows.map((m) => ({
      id: Number(m.id), fila_id: Number(m.fila_id), user_id: m.user_id, tipo: m.tipo, url: m.url, ms: m.ms, duracao_ms: m.duracao_ms, motivo: m.motivo,
      created_at: m.created_at, titulo: m.titulo, faixa: m.faixa, nome: m.nome, dueto_nome: m.dueto_nome, dueto_user_id: m.dueto_user_id,
    })),
    reels: reels.rows.map((r) => ({ ...r, fila_id: Number(r.fila_id) })),
  });
}));

/**
 * POST (só admin, o telão): registra um momento já enviado ao Blob. Corpo: { fila_id, tipo: 'foto' | 'clipe', url, ms, duracao_ms, motivo }.
 * A url precisa ser do nosso Blob e estar na pasta karaoke/momentos/<ano>/<fila_id>/. A foto também vai para o álbum da família.
 */
export const POST = route(comMigracao(async (req) => {
  const admin = await requireAdmin();
  const body = await readJson<{ fila_id?: unknown; tipo?: unknown; url?: unknown; ms?: unknown; duracao_ms?: unknown; motivo?: unknown }>(req);
  const filaId = toInt(body.fila_id, 'fila_id');
  const tipo = body.tipo === 'foto' || body.tipo === 'clipe' ? body.tipo : null;
  if (!tipo) throw new HttpError(400, 'Tipo inválido.');
  const urlBlob = body.url;
  if (!isBlobUrl(urlBlob)) throw new HttpError(400, 'Endereço do arquivo inválido.');

  const { rows } = await query<{ ano: number; user_id: number }>('SELECT ano, user_id FROM karaoke_fila WHERE id = $1', [filaId]);
  const f = rows[0];
  if (!f) throw new HttpError(404, 'Música não encontrada na fila.');
  if (!new URL(urlBlob).pathname.startsWith(`/karaoke/momentos/${f.ano}/${filaId}/`)) throw new HttpError(400, 'Endereço do arquivo inválido.');

  const ms = inteiroOpcional(body.ms, 0, 4 * 3600 * 1000, 'ms');
  const duracao = inteiroOpcional(body.duracao_ms, 0, 120_000, 'duracao_ms');
  const motivo = cleanText(body.motivo, 'o motivo', 60, false) || null;

  const { rows: nova } = await query<{ id: number | string }>(
    `INSERT INTO karaoke_momentos (fila_id, ano, user_id, tipo, url, ms, duracao_ms, motivo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [filaId, f.ano, f.user_id, tipo, urlBlob, ms, duracao, motivo],
  );
  if (tipo === 'foto') {
    const fila = await lerFilaParaAlbum(filaId);
    if (fila) await publicarNoAlbum(fila, admin.id, filaId, urlBlob, fila.nota);
  }
  return ok({ id: Number(nova[0].id) }, 201);
}));
