import { cleanText, HttpError, ok, readJson, requireAdmin, requireUser, route, toInt } from '@/app/lib/api';
import { query, transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { acaoRoteiroValida, ordenarRoteiro, ROTEIRO_PADRAO_NATAL, type ItemRoteiro } from '@/app/telao/roteiro';
import { limparCacheTelao } from '../estado/_data';

export const dynamic = 'force-dynamic';

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function tratarErroBanco(e: unknown): never {
  if ((e as { code?: string } | null)?.code === '42P01') {
    throw new HttpError(503, 'Rode a migração 035');
  }
  throw e;
}

async function listarDoAno(ano: number): Promise<ItemRoteiro[]> {
  try {
    const { rows } = await query<ItemRoteiro>(
      `SELECT id::int AS id, to_char(hora, 'HH24:MI') AS hora, acao, texto
         FROM telao_roteiro
        WHERE ano = $1
        ORDER BY CASE WHEN hora < '06:00:00'::time THEN 1 ELSE 0 END, hora ASC, id ASC`,
      [ano],
    );
    return ordenarRoteiro(rows);
  } catch (e) {
    tratarErroBanco(e);
  }
}

export const GET = route(async () => {
  await requireUser();
  const ano = edicaoAtual();
  const itens = await listarDoAno(ano);
  return ok({ ano, itens });
});

export const POST = route(async (req) => {
  await requireAdmin();
  const body = await readJson<Record<string, unknown>>(req);
  const ano = edicaoAtual();

  if (body.modelo === true) {
    try {
      await transaction(async (q) => {
        await q('DELETE FROM telao_roteiro WHERE ano = $1', [ano]);
        for (const item of ROTEIRO_PADRAO_NATAL) {
          await q(
            'INSERT INTO telao_roteiro (ano, hora, acao, texto) VALUES ($1, $2::time, $3, $4)',
            [ano, item.hora, item.acao, item.texto],
          );
        }
      });
    } catch (e) {
      tratarErroBanco(e);
    }
    limparCacheTelao();
    const itens = await listarDoAno(ano);
    return ok({ ok: true, ano, itens }, 201);
  }

  const hora = typeof body.hora === 'string' ? body.hora.trim() : '';
  if (!HORA_RE.test(hora)) {
    throw new HttpError(400, 'Informe a hora no formato HH:MM.');
  }
  const acao = typeof body.acao === 'string' ? body.acao.trim() : '';
  if (!acaoRoteiroValida(acao)) {
    throw new HttpError(400, 'Escolha uma ação válida para o roteiro.');
  }
  const texto =
    acao === 'aviso'
      ? cleanText(body.texto, 'o texto do aviso', 120, true).replace(/\s+/g, ' ')
      : body.texto != null && String(body.texto).trim() !== ''
        ? cleanText(body.texto, 'o texto', 120, false).replace(/\s+/g, ' ')
        : null;

  let item: ItemRoteiro;
  try {
    const { rows } = await query<ItemRoteiro>(
      `INSERT INTO telao_roteiro (ano, hora, acao, texto)
       VALUES ($1, $2::time, $3, $4)
       RETURNING id::int AS id, to_char(hora, 'HH24:MI') AS hora, acao, texto`,
      [ano, hora, acao, texto],
    );
    item = rows[0];
  } catch (e) {
    tratarErroBanco(e);
  }

  limparCacheTelao();
  const itens = await listarDoAno(ano);
  return ok({ ok: true, ano, item, itens }, 201);
});

export const DELETE = route(async (req) => {
  await requireAdmin();
  const id = toInt(new URL(req.url).searchParams.get('id'), 'id');
  const ano = edicaoAtual();
  try {
    await query('DELETE FROM telao_roteiro WHERE id = $1 AND ano = $2', [id, ano]);
  } catch (e) {
    tratarErroBanco(e);
  }
  limparCacheTelao();
  const itens = await listarDoAno(ano);
  return ok({ ok: true, ano, itens });
});
