import { randomUUID } from 'node:crypto';
import { route, ok, readJson, requireUser, requireAdmin, HttpError, toInt } from '@/app/lib/api';
import { query, transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { dentroDoLimite } from '@/app/lib/limite';
import { prepararNotas, type NotaEstudio } from '@/app/telao/karaoke/pontuacao';
import { compararBatalha, notasLinhasValidas, MAX_LINHAS_BATALHA, type EstadoBatalha } from '@/app/telao/karaoke/batalha';
import type { DadosEstudio } from '@/app/telao/karaoke/tipos';

export const dynamic = 'force-dynamic';
type Q = typeof query;

function comMigracao(handler: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try { return await handler(req); }
    catch (erro) {
      const codigo = typeof erro === 'object' && erro !== null ? (erro as { code?: string }).code : null;
      if (codigo === '42P01' || codigo === '42703') throw new HttpError(503, 'Rode a migração 044 e as anteriores do karaokê.');
      throw erro;
    }
  };
}

function idPositivo(valor: unknown, campo: string) {
  const id = toInt(valor, campo);
  if (id <= 0 || !Number.isSafeInteger(id)) throw new HttpError(400, `Campo ${campo} inválido.`);
  return id;
}

async function carregar(q: Q, id: string, ano: number): Promise<EstadoBatalha> {
  const { rows } = await q<{ id: string; titulo: string; trechos: string[] }>(
    'SELECT id, titulo, trechos FROM karaoke_batalhas WHERE id = $1 AND ano = $2', [id, ano],
  );
  if (!rows.length) throw new HttpError(404, 'Batalha não encontrada.');
  const { rows: entradas } = await q<{
    id: number | string; user_id: number; nome: string; rodada: 1 | 2;
    status: 'fila' | 'cantando' | 'feita' | 'pulada'; notas_linhas: number[] | null;
  }>(
    `SELECT f.id, f.user_id, u.name AS nome, f.batalha_rodada AS rodada, f.status, f.notas_linhas
       FROM karaoke_fila f JOIN family_users u ON u.id = f.user_id
      WHERE f.batalha_id = $1 AND f.ano = $2 ORDER BY f.batalha_rodada`, [id, ano],
  );
  const apresentacoes = entradas.map((r) => ({ ...r, id: Number(r.id) }));
  const cancelada = apresentacoes.length !== 2 || apresentacoes.some((r) => r.status === 'pulada');
  const notas = (rodada: number) => {
    const entrada = apresentacoes.find((r) => r.rodada === rodada);
    return !cancelada && entrada?.status === 'feita' ? entrada.notas_linhas : null;
  };
  return { ...rows[0], apresentacoes, cancelada, resultado: compararBatalha(notas(1), notas(2)) };
}

/** GET ?id=UUID ou ?fila_id=123: pode consultar com qualquer conta da família. */
export const GET = route(comMigracao(async (req) => {
  await requireUser();
  const ano = edicaoAtual();
  const params = new URL(req.url).searchParams;
  let id = params.get('id');
  if (!id) {
    const filaId = idPositivo(params.get('fila_id'), 'fila_id');
    const { rows } = await query<{ batalha_id: string | null }>('SELECT batalha_id FROM karaoke_fila WHERE id = $1 AND ano = $2', [filaId, ano]);
    id = rows[0]?.batalha_id ?? null;
    if (!id) throw new HttpError(404, 'Essa apresentação não pertence a uma batalha.');
  }
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) throw new HttpError(400, 'Identificador da batalha inválido.');
  return ok(await carregar(query, id, ano));
}));

/** POST { fila_id, adversario_id }: transforma um pedido individual em duas apresentações da mesma música. */
export const POST = route(comMigracao(async (req) => {
  const me = await requireUser();
  const ano = edicaoAtual();
  const body = await readJson<{ fila_id?: unknown; adversario_id?: unknown }>(req);
  const filaId = idPositivo(body.fila_id, 'fila_id');
  const adversario = idPositivo(body.adversario_id, 'adversario_id');
  if (!dentroDoLimite('karaoke-batalha', me.id, 6)) throw new HttpError(429, 'Espere um minutinho antes de criar outra batalha.');

  const batalha = await transaction(async (q) => {
    await q('SELECT pg_advisory_xact_lock(hashtext($1))', [`karaoke:${ano}`]);
    const { rows } = await q<{
      user_id: number; dueto_user_id: number | null; status: string; batalha_id: string | null;
      titulo: string; catalogo_id: number | string | null; video_id: string;
    }>('SELECT user_id, dueto_user_id, status, batalha_id, titulo, catalogo_id, video_id FROM karaoke_fila WHERE id = $1 AND ano = $2 FOR UPDATE', [filaId, ano]);
    const origem = rows[0];
    if (!origem) throw new HttpError(404, 'Música não encontrada.');
    if (!me.is_admin && origem.user_id !== me.id) throw new HttpError(403, 'Escolha uma música da sua própria fila.');
    if (origem.status !== 'fila' || origem.batalha_id || origem.dueto_user_id !== null) throw new HttpError(409, 'Escolha um pedido individual que ainda está na fila e não pertence a outra batalha.');
    if (origem.user_id === adversario) throw new HttpError(400, 'Escolha outra pessoa para a batalha.');
    const { rows: pessoas } = await q('SELECT id FROM family_users WHERE id = $1', [adversario]);
    if (!pessoas.length) throw new HttpError(400, 'Essa pessoa não está na família.');
    const { rows: pendentes } = await q<{ video_id: string; catalogo_id: number | string | null; batalha_rodada: number | null }>(
      `SELECT video_id, catalogo_id, batalha_rodada FROM karaoke_fila WHERE ano = $1 AND user_id = $2 AND status IN ('fila', 'cantando')`, [ano, adversario],
    );
    // Um desafio já recebido (rodada 2) não conta no limite de duas músicas, mas a música repetida continua barrada.
    if (pendentes.filter((p) => p.batalha_rodada !== 2).length >= 2) throw new HttpError(409, 'Essa pessoa já tem duas músicas esperando.');
    if (pendentes.some((p) => p.video_id === origem.video_id || (origem.catalogo_id !== null && Number(p.catalogo_id) === Number(origem.catalogo_id)))) throw new HttpError(409, 'Essa pessoa já pediu a mesma música.');
    const { rows: catalogo } = await q<{ notas: NotaEstudio[]; palavras: DadosEstudio['palavras'] }>(
      `SELECT notas, palavras FROM karaoke_catalogo WHERE id = $1 AND status = 'pronta'
         AND audio_url IS NOT NULL AND notas IS NOT NULL AND palavras IS NOT NULL`, [origem.catalogo_id],
    );
    const musica = catalogo[0];
    const linhas = [...new Set(prepararNotas(musica?.notas).map((n) => n.linha))].sort((a, b) => a - b);
    if (!musica || !linhas.length || linhas.length > MAX_LINHAS_BATALHA) throw new HttpError(409, 'A batalha precisa de uma música do estúdio pronta, com notas por linha.');
    const trechos = linhas.map((linha, i) => musica.palavras.linhas[linha]?.texto || `Trecho ${i + 1}`);
    const id = randomUUID();
    await q('INSERT INTO karaoke_batalhas (id, ano, criado_por, titulo, trechos) VALUES ($1, $2, $3, $4, $5::jsonb)', [id, ano, me.id, origem.titulo, JSON.stringify(trechos)]);
    await q(`UPDATE karaoke_fila SET batalha_id = $1, batalha_rodada = 1, notas_linhas = NULL, modo = 'estudio', offset_ms = 0 WHERE id = $2`, [id, filaId]);
    await q(
      `INSERT INTO karaoke_fila (ano, user_id, video_id, titulo, canal, duracao_s, miniatura, posicao,
         faixa, artista, lrclib_id, letra, offset_ms, modo, candidatos, catalogo_id, batalha_id, batalha_rodada)
       SELECT f.ano, $1, f.video_id, f.titulo, f.canal, f.duracao_s, f.miniatura,
         (SELECT COALESCE(MAX(posicao), 0) + 1 FROM karaoke_fila WHERE ano = $2),
         f.faixa, f.artista, f.lrclib_id, f.letra, 0, 'estudio', f.candidatos, f.catalogo_id, $3, 2
       FROM karaoke_fila f WHERE f.id = $4 AND f.ano = $2`, [adversario, ano, id, filaId],
    );
    return carregar(q, id, ano);
  });
  return ok(batalha, 201);
}));

/** PATCH { fila_id, notas_linhas }: envio posterior ao término, somente pelo organizador do telão. */
export const PATCH = route(comMigracao(async (req) => {
  await requireAdmin();
  const ano = edicaoAtual();
  const body = await readJson<{ fila_id?: unknown; notas_linhas?: unknown }>(req);
  const filaId = idPositivo(body.fila_id, 'fila_id');
  if (!notasLinhasValidas(body.notas_linhas)) throw new HttpError(400, 'Envie notas_linhas como frações de 0 a 1.');
  const notas = body.notas_linhas;
  const batalha = await transaction(async (q) => {
    await q('SELECT pg_advisory_xact_lock(hashtext($1))', [`karaoke:${ano}`]);
    const { rows } = await q<{ batalha_id: string; status: string; notas_linhas: number[] | null; total: number }>(
      `SELECT f.batalha_id, f.status, f.notas_linhas, jsonb_array_length(b.trechos) AS total
         FROM karaoke_fila f JOIN karaoke_batalhas b ON b.id = f.batalha_id
        WHERE f.id = $1 AND f.ano = $2 FOR UPDATE OF f`, [filaId, ano],
    );
    const entrada = rows[0];
    if (!entrada) throw new HttpError(404, 'Apresentação de batalha não encontrada.');
    if (entrada.status !== 'feita') throw new HttpError(409, 'Termine a apresentação antes de registrar o resultado.');
    if (notas.length !== entrada.total) throw new HttpError(400, 'A batalha exige a pontuação de todas as linhas da música.');
    if (entrada.notas_linhas && JSON.stringify(entrada.notas_linhas) !== JSON.stringify(notas)) throw new HttpError(409, 'O resultado dessa apresentação já foi registrado.');
    await q('UPDATE karaoke_fila SET notas_linhas = $1::jsonb WHERE id = $2', [JSON.stringify(notas), filaId]);
    return carregar(q, entrada.batalha_id, ano);
  });
  return ok(batalha);
}));

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/**
 * DELETE ?id=UUID: recusa (ou cancela) o desafio. Vale para o adversário, para quem criou e para o organizador,
 * só enquanto nenhuma rodada começou. A rodada 1 volta a ser um pedido normal e a rodada 2 é removida.
 */
export const DELETE = route(comMigracao(async (req) => {
  const me = await requireUser();
  const ano = edicaoAtual();
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!UUID.test(id)) throw new HttpError(400, 'Identificador da batalha inválido.');
  await transaction(async (q) => {
    await q('SELECT pg_advisory_xact_lock(hashtext($1))', [`karaoke:${ano}`]);
    const { rows: lote } = await q<{ criado_por: number | null }>('SELECT criado_por FROM karaoke_batalhas WHERE id = $1 AND ano = $2 FOR UPDATE', [id, ano]);
    if (!lote.length) throw new HttpError(404, 'Batalha não encontrada.');
    const { rows: entradas } = await q<{ id: number | string; user_id: number; status: string; batalha_rodada: number }>(
      'SELECT id, user_id, status, batalha_rodada FROM karaoke_fila WHERE batalha_id = $1 AND ano = $2 FOR UPDATE', [id, ano],
    );
    const adversario = entradas.find((e) => e.batalha_rodada === 2)?.user_id;
    if (!me.is_admin && me.id !== lote[0].criado_por && me.id !== adversario) throw new HttpError(403, 'Só quem foi desafiado, quem desafiou ou o organizador pode recusar.');
    if (entradas.length !== 2 || entradas.some((e) => e.status !== 'fila')) throw new HttpError(409, 'Essa batalha já começou e não pode mais ser recusada.');
    for (const e of entradas) {
      if (e.batalha_rodada === 2) await q('DELETE FROM karaoke_fila WHERE id = $1', [e.id]);
      else await q('UPDATE karaoke_fila SET batalha_id = NULL, batalha_rodada = NULL, notas_linhas = NULL WHERE id = $1', [e.id]);
    }
    await q('DELETE FROM karaoke_batalhas WHERE id = $1', [id]);
  });
  return ok({ ok: true });
}));
