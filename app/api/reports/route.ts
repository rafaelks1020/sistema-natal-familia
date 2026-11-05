import { parsePostImages } from '../posts/_utils';
import { query, transaction } from '@/app/lib/db';
import { cleanText, HttpError, ok, readJson, requireAdmin, requireUser, route, toInt } from '@/app/lib/api';
import { ALVOS, alvoDe, alvoValido } from '@/app/lib/denuncias';
import { enviarPush } from '@/app/lib/push';

export const POST = route(async (req) => {
  const me = await requireUser();
  const body = await readJson<Record<string, unknown>>(req);
  if (body.alvo_tipo != null) {
    if (!alvoValido(body.alvo_tipo)) throw new HttpError(400, 'Tipo de conteúdo inválido.');
    const alvo = ALVOS[body.alvo_tipo];
    const alvoId = toInt(body.alvo_id);
    const motivoAlvo = cleanText(body.motivo, 'o motivo', 1000);
    // Tabela e coluna vêm só do registro fixo em denuncias.ts, nunca do corpo da requisição.
    const { rows: alvoRows } = await query(
      `SELECT user_id, LEFT(COALESCE(${alvo.texto}::text, ''), 1000) AS trecho FROM ${alvo.tabela} WHERE id = $1`, [alvoId]);
    if (!alvoRows.length) throw new HttpError(404, 'Conteúdo não encontrado.');
    const { rows } = await query(
      `INSERT INTO content_reports (reporter_id, alvo_tipo, alvo_id, autor_id, trecho, motivo)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [me.id, body.alvo_tipo, alvoId, alvoRows[0].user_id, alvoRows[0].trecho, motivoAlvo]);
    const { rows: admins } = await query<{ id: number }>('SELECT id FROM family_users WHERE is_admin');
    void enviarPush(admins.map((a) => a.id), { titulo: 'Nova denúncia', corpo: `${alvo.rotulo} denunciado para análise.`, rota: '/organizar' });
    return ok(rows[0], 201);
  }
  const hasPost = body.post_id != null;
  const hasComment = body.comment_id != null;
  if (hasPost === hasComment) throw new HttpError(400, 'Escolha uma publicação ou um comentário.');
  const id = toInt(hasPost ? body.post_id : body.comment_id);
  const motivo = cleanText(body.motivo, 'o motivo', 1000);
  const report = await transaction(async (q) => {
    const target = hasPost
      ? await q('SELECT id FROM family_posts WHERE id = $1 FOR KEY SHARE', [id])
      : await q('SELECT id, post_id FROM family_post_comments WHERE id = $1 FOR KEY SHARE', [id]);
    if (!target.rows.length) throw new HttpError(404, 'Conteúdo não encontrado.');
    const { rows } = await q(
      'INSERT INTO content_reports (reporter_id, post_id, comment_id, motivo) VALUES ($1, $2, $3, $4) RETURNING id',
      [me.id, hasPost ? id : null, hasComment ? id : null, motivo],
    );
    await q(`INSERT INTO family_notifications (user_id, actor_id, type, post_id, comment_id)
      SELECT id, $1, 'report', $2, $3 FROM family_users WHERE is_admin`,
      [me.id, hasPost ? id : target.rows[0].post_id, hasComment ? id : null]);
    return rows[0];
  });
  return ok(report, 201);
});

export const GET = route(async () => {
  await requireAdmin();
  const { rows } = await query(`SELECT r.id, r.post_id, r.comment_id, r.alvo_tipo, r.alvo_id, r.motivo, r.created_at,
    reporter.name AS reporter_name, author.id AS author_id, author.name AS author_name,
    LEFT(COALESCE(c.content, p.content, r.trecho, ''), 1000) AS content,
    COALESCE(p.image_url, cp.image_url) AS image_url,
    COALESCE(p.image_urls, cp.image_urls) AS image_urls
    FROM content_reports r
    JOIN family_users reporter ON reporter.id = r.reporter_id
    LEFT JOIN family_posts p ON p.id = r.post_id
    LEFT JOIN family_post_comments c ON c.id = r.comment_id
    LEFT JOIN family_posts cp ON cp.id = c.post_id
    JOIN family_users author ON author.id = COALESCE(c.user_id, p.user_id, r.autor_id)
    WHERE r.resolved_at IS NULL ORDER BY r.created_at, r.id`);
  return ok(rows.map((row) => ({
    ...row,
    tipo_rotulo: alvoDe(row.alvo_tipo)?.rotulo ?? (row.comment_id ? 'Comentário' : 'Publicação'),
    images: row.comment_id || row.alvo_tipo ? [] : parsePostImages(row.image_urls, row.image_url),
  })));
});
