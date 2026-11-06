import { route, ok, readJson, cleanText, toInt, HttpError, requireUser } from '@/app/lib/api';
import { query, transaction } from '@/app/lib/db';
import { dentroDoLimite } from '@/app/lib/limite';
import { COLUNAS_CATALOGO, comMigracaoEstudio, EM_PREPARO, MAX_EM_PREPARO, musicaCatalogo, slugDaMusica, type LinhaCatalogo } from '../_catalogo';

export const dynamic = 'force-dynamic';

/** Catálogo do estúdio: músicas prontas e em preparo. Busca por texto sem acento (compara com o slug). */
export const GET = route(comMigracaoEstudio(async (req) => {
  await requireUser();
  const q = (new URL(req.url).searchParams.get('q') ?? '').slice(0, 120);
  const tokens = q.trim() ? slugDaMusica(q, '').split('-').filter((t) => t && t !== 'faixa').slice(0, 6) : [];
  const filtros = tokens.map((_, i) => `slug LIKE $${i + 1}`);
  const { rows } = await query<LinhaCatalogo>(
    `SELECT ${COLUNAS_CATALOGO} FROM karaoke_catalogo
      WHERE status <> 'falhou' ${filtros.length ? `AND ${filtros.join(' AND ')}` : ''}
      ORDER BY (status = 'pronta') DESC, artista, faixa
      LIMIT 200`,
    tokens.map((t) => `%${t}%`),
  );
  return ok({ musicas: rows.map(musicaCatalogo) });
}));

/** Pede o preparo de uma música: cria o registro 'na_fila' (ou devolve o que já existe pelo slug). */
export const POST = route(comMigracaoEstudio(async (req) => {
  const me = await requireUser();
  const body = await readJson<{ lrclib_id?: unknown; artista?: unknown; faixa?: unknown; duracao_s?: unknown }>(req);
  const lrclibId = toInt(body.lrclib_id, 'lrclib_id');
  const artista = cleanText(body.artista, 'o artista', 160);
  const faixa = cleanText(body.faixa, 'a faixa', 200);
  let duracaoMs: number | null = null;
  if (body.duracao_s != null && body.duracao_s !== '') {
    const s = Number(body.duracao_s);
    if (!Number.isFinite(s) || s < 1 || s > 3 * 3600) throw new HttpError(400, 'Campo duracao_s inválido.');
    duracaoMs = Math.round(s * 1000);
  }
  const slug = slugDaMusica(artista, faixa);
  if (!dentroDoLimite('karaoke-catalogo', me.id, 8)) throw new HttpError(429, 'Muitos pedidos seguidos. Espere um minutinho e tente de novo.');

  const existente = async (q: typeof query) => (await q<LinhaCatalogo>(`SELECT ${COLUNAS_CATALOGO} FROM karaoke_catalogo WHERE slug = $1`, [slug])).rows[0];

  const ja = await existente(query);
  if (ja) return ok({ ...musicaCatalogo(ja), existente: true });

  const criada = await transaction(async (q) => {
    await q('SELECT pg_advisory_xact_lock(hashtext($1))', ['karaoke-catalogo']);
    const dup = await existente(q);
    if (dup) return { linha: dup, nova: false };
    const { rows: prep } = await q('SELECT 1 FROM karaoke_catalogo WHERE pedido_por = $1 AND status = ANY($2::text[])', [me.id, EM_PREPARO]);
    if (prep.length >= MAX_EM_PREPARO) throw new HttpError(400, `Você já tem ${MAX_EM_PREPARO} músicas em preparo. Espere uma ficar pronta para pedir outra.`);
    const { rows } = await q<LinhaCatalogo>(
      `INSERT INTO karaoke_catalogo (slug, artista, faixa, duracao_ms, lrclib_id, status, pedido_por)
       VALUES ($1, $2, $3, $4, $5, 'na_fila', $6) RETURNING ${COLUNAS_CATALOGO}`,
      [slug, artista, faixa, duracaoMs, lrclibId, me.id],
    );
    return { linha: rows[0], nova: true };
  });
  return ok({ ...musicaCatalogo(criada.linha), existente: !criada.nova }, criada.nova ? 201 : 200);
}));
