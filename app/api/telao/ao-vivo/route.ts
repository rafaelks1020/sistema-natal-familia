import { cleanText, HttpError, ok, readJson, requireAdmin, requireUser, toInt, route } from '@/app/lib/api';
import { query, transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';

export const dynamic = 'force-dynamic';

// Reações e recados do telão. A lista é a mesma do CHECK da migração 033.
const EMOJIS = ['\u2764\uFE0F', '\u{1F602}', '\u{1F384}', '\u{1F385}', '\u{1F44F}', '\u{1F942}', '\u{1F60D}', '\u{1F525}'] as const;

const SEM_TABELA = 'Rode a migração 033';

type ReacaoRow = { id: string | number; emoji: string };
type RecadoRow = { id: string | number; nome: string; texto: string };

function semTabela(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === '42P01';
}

function falhaTabela(err: unknown): never {
  if (err instanceof HttpError) throw err;
  if (semTabela(err)) throw new HttpError(503, SEM_TABELA);
  throw err;
}

/** some no GET de quem bloqueou ou foi bloqueado. Pendência de moderação não usa este filtro. */
function semBloqueio(coluna: string, param: string): string {
  return `NOT EXISTS (
    SELECT 1 FROM user_blocks b
    WHERE (b.blocker_id = ${param} AND b.blocked_id = ${coluna})
       OR (b.blocker_id = ${coluna} AND b.blocked_id = ${param})
  )`;
}

function emojiPermitido(value: unknown): string {
  if (typeof value !== 'string') throw new HttpError(400, 'Escolha um emoji.');
  const s = value.trim().normalize('NFC');
  const emoji = s === '\u2764' ? '\u2764\uFE0F' : s;
  if (!(EMOJIS as readonly string[]).includes(emoji)) throw new HttpError(400, 'Escolha um emoji da lista.');
  return emoji;
}

function lerDesde(req: Request): number {
  const bruto = new URL(req.url).searchParams.get('desde');
  if (bruto === null || bruto === '') return 0;
  const n = Number(bruto);
  if (!Number.isInteger(n) || n < 0) throw new HttpError(400, 'Parâmetro desde inválido.');
  return n;
}

export const GET = route(async (req) => {
  const me = await requireUser();
  const desde = lerDesde(req);
  const ano = edicaoAtual();
  try {
    const reacoes = await query<ReacaoRow>(
      `SELECT r.id, r.emoji
       FROM telao_reacoes r
       WHERE r.ano = $1 AND r.id > $2 AND r.created_at > NOW() - INTERVAL '15 seconds'
         AND ${semBloqueio('r.user_id', '$3')}
       ORDER BY r.id ASC
       LIMIT 300`,
      [ano, desde, me.id],
    );
    const recados = await query<RecadoRow>(
      `SELECT r.id, u.name AS nome, r.texto
       FROM telao_recados_vivo r
       JOIN family_users u ON u.id = r.user_id
       WHERE r.ano = $1 AND r.status = 'aprovado' AND r.moderado_em > NOW() - INTERVAL '2 minutes'
         AND ${semBloqueio('r.user_id', '$2')}
       ORDER BY r.id ASC`,
      [ano, me.id],
    );
    const pendentes = me.is_admin
      ? await query<RecadoRow>(
        `SELECT r.id, u.name AS nome, r.texto
         FROM telao_recados_vivo r
         JOIN family_users u ON u.id = r.user_id
         WHERE r.ano = $1 AND r.status = 'pendente'
         ORDER BY r.id ASC`,
        [ano],
      )
      : null;
    return ok({
      reacoes: reacoes.rows.map((r) => ({ id: Number(r.id), emoji: r.emoji })),
      recados: recados.rows.map((r) => ({ id: Number(r.id), nome: r.nome, texto: r.texto })),
      ...(pendentes ? { pendentes: pendentes.rows.map((r) => ({ id: Number(r.id), nome: r.nome, texto: r.texto })) } : {}),
    });
  } catch (err) {
    falhaTabela(err);
  }
});

export const POST = route(async (req) => {
  const me = await requireUser();
  const body = await readJson<Record<string, unknown>>(req);
  const ano = edicaoAtual();
  try {
    if (body.tipo === 'reacao') {
      const emoji = emojiPermitido(body.emoji);
      const id = await transaction(async (q) => {
        await q('SELECT pg_advisory_xact_lock($1, $2)', [16011, me.id]);
        const { rows } = await q<{ id: string | number }>(
          `INSERT INTO telao_reacoes (ano, user_id, emoji)
           SELECT $1, $2, $3
           WHERE NOT EXISTS (
             SELECT 1 FROM telao_reacoes
             WHERE user_id = $2 AND ano = $1 AND created_at > NOW() - INTERVAL '1 second'
           )
           RETURNING id`,
          [ano, me.id, emoji],
        );
        if (!rows.length) throw new HttpError(429, 'Espere um segundo para reagir de novo.');
        return Number(rows[0].id);
      });
      return ok({ id }, 201);
    }
    if (body.tipo === 'recado') {
      const texto = cleanText(body.texto, 'o recado', 140).replace(/\s+/g, ' ');
      if (!texto) throw new HttpError(400, 'Preencha o recado.');
      const id = await transaction(async (q) => {
        await q('SELECT pg_advisory_xact_lock($1, $2)', [16012, me.id]);
        const { rows } = await q<{ id: string | number }>(
          // Recado de quem organiza já entra aprovado.
          `INSERT INTO telao_recados_vivo (ano, user_id, texto, status, moderado_em)
           SELECT $1, $2, $3, CASE WHEN $4 THEN 'aprovado' ELSE 'pendente' END, CASE WHEN $4 THEN NOW() END
           WHERE NOT EXISTS (
             SELECT 1 FROM telao_recados_vivo
             WHERE user_id = $2 AND ano = $1 AND created_at > NOW() - INTERVAL '30 seconds'
           )
           RETURNING id`,
          [ano, me.id, texto, me.is_admin],
        );
        if (!rows.length) throw new HttpError(429, 'Espere 30 segundos para mandar outro recado.');
        return Number(rows[0].id);
      });
      return ok({ id, aprovado: me.is_admin }, 201);
    }
    throw new HttpError(400, 'Tipo inválido.');
  } catch (err) {
    falhaTabela(err);
  }
});

export const PATCH = route(async (req) => {
  await requireAdmin();
  const body = await readJson<Record<string, unknown>>(req);
  const id = toInt(body.id);
  if (body.status !== 'aprovado' && body.status !== 'recusado') throw new HttpError(400, 'Status inválido.');
  try {
    const { rows } = await query<{ id: string | number }>(
      `UPDATE telao_recados_vivo
       SET status = $1, moderado_em = NOW()
       WHERE id = $2 AND ano = $3
       RETURNING id`,
      [body.status, id, edicaoAtual()],
    );
    if (!rows.length) throw new HttpError(404, 'Recado não encontrado.');
    return ok({ ok: true });
  } catch (err) {
    falhaTabela(err);
  }
});
