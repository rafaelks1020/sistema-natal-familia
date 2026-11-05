import { HttpError } from '@/app/lib/api';
import { query, transaction } from '@/app/lib/db';
import type { SessionUser } from '@/app/lib/session';
import { achar, FERRAMENTAS, GRUPOS, RECURSOS, type EditavelDef, type Recurso } from './recursos';
import { CHAVES_OCULTAS } from './seguranca';
import type { ItemAdmin, LogItem, PaginaLog, PaginaRecurso, RecursoMeta, Resumo } from './tipos';

// Motor do painel admin. Todo identificador SQL (tabela, alias, coluna) vem de recursos.ts;
// o que chega da requisição só entra como parâmetro ($1, $2...).

const POR_PAGINA = 20;

// ---------- Quais tabelas existem (migrações ainda não aplicadas escondem o recurso) ----------
let cacheTabelas: { quando: number; ok: Set<string> } | null = null;

async function tabelasExistentes(): Promise<Set<string>> {
  if (cacheTabelas && Date.now() - cacheTabelas.quando < 60_000) return cacheTabelas.ok;
  const todas = [...new Set(RECURSOS.flatMap((r) => r.tabelas))];
  const { rows } = await query<{ t: string; existe: boolean }>(
    `SELECT t, to_regclass('public.' || t) IS NOT NULL AS existe FROM unnest($1::text[]) AS t`,
    [todas],
  );
  cacheTabelas = { quando: Date.now(), ok: new Set(rows.filter((r) => r.existe).map((r) => r.t)) };
  return cacheTabelas.ok;
}

async function disponiveis(): Promise<Recurso[]> {
  const ok = await tabelasExistentes();
  return RECURSOS.filter((r) => r.tabelas.every((t) => ok.has(t)));
}

export async function recursoDisponivel(id: string): Promise<Recurso> {
  const r = achar(id);
  if (!r) throw new HttpError(404, 'Área não encontrada.');
  const ok = await tabelasExistentes();
  if (!r.tabelas.every((t) => ok.has(t))) throw new HttpError(404, 'Esta área ainda não está ativa.');
  return r;
}

// ---------- Utilidades ----------
const idCol = (r: Recurso) => r.idCol ?? 'id';
const idExpr = (r: Recurso) => `${r.alias}.${idCol(r)}`;

export function metaDe(r: Recurso): RecursoMeta {
  return {
    id: r.id,
    nome: r.nome,
    colunas: r.colunas.map(({ campo, rotulo, tipo }) => ({ campo, rotulo, tipo })),
    editaveis: r.editaveis.map(({ campo, rotulo, tipo, opcoes }) => ({ campo, rotulo, tipo, ...(opcoes ? { opcoes } : {}) })),
    pode_apagar: r.pode_apagar,
    acoes: r.acoes,
  };
}

/** Converte o id da URL: número positivo, ou texto curto quando a chave do recurso é texto. */
export function lerId(r: Recurso, bruto: string): number | string {
  if (idCol(r) === 'key') {
    if (!bruto || bruto.length > 120) throw new HttpError(400, 'Identificador inválido.');
    return bruto;
  }
  if (!/^\d{1,10}$/.test(bruto) || Number(bruto) <= 0) throw new HttpError(400, 'Identificador inválido.');
  return Number(bruto);
}

function normalizar(r: Recurso, row: Record<string, unknown>): ItemAdmin {
  const item: ItemAdmin = { id: row.id as number | string };
  for (const c of r.colunas) {
    let v = row[c.campo];
    if (v instanceof Date) v = v.toISOString();
    else if ((c.tipo === 'numero' || c.tipo === 'dinheiro') && v != null) v = Number(v);
    item[c.campo] = v ?? null;
  }
  return item;
}

function selecao(r: Recurso): string {
  const cols = r.colunas.map((c) => `${c.sql} AS "${c.campo}"`).join(', ');
  return `SELECT ${idExpr(r)} AS id, ${cols} FROM ${r.from}`;
}

/** Erros do banco por valor inválido viram mensagem simples, sem vazar detalhe. */
export function erroBanco(err: unknown): never {
  const code = (err as { code?: string } | null)?.code;
  if (code === '23503') throw new HttpError(409, 'Ainda existem dados ligados a este item.');
  if (code && ['23514', '23505', '22001', '22003', '22P02', '23502'].includes(code)) {
    throw new HttpError(400, 'O banco não aceitou esse valor. Confira e tente de novo.');
  }
  throw err;
}

// ---------- Listagem ----------
export async function listar(r: Recurso, busca: string, cursor: string): Promise<PaginaRecurso> {
  const params: unknown[] = [];
  const where: string[] = [];
  const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
  if (r.filtro) where.push(r.filtro);
  if (r.chavesOcultas) where.push(`${idExpr(r)} !~* ${p(CHAVES_OCULTAS)}`);
  if (cursor) {
    if (idCol(r) === 'key') {
      if (cursor.length > 120) throw new HttpError(400, 'Cursor inválido.');
      where.push(`${idExpr(r)} > ${p(cursor)}`);
    } else {
      if (!/^\d{1,18}$/.test(cursor)) throw new HttpError(400, 'Cursor inválido.');
      where.push(`${idExpr(r)} < ${p(Number(cursor))}`);
    }
  }
  const q = busca.trim().slice(0, 80);
  if (q) {
    const like = p(`%${q.replace(/[\\%_]/g, '\\$&')}%`);
    const exato = p(q);
    where.push(`(${[...r.busca.map((b) => `${b}::text ILIKE ${like}`), `${idExpr(r)}::text = ${exato}`].join(' OR ')})`);
  }
  const sql = `${selecao(r)}${where.length ? ` WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ${idExpr(r)} ${r.ordemAsc ? 'ASC' : 'DESC'} LIMIT ${POR_PAGINA + 1}`;
  const { rows } = await query(sql, params);
  const mais = rows.length > POR_PAGINA;
  const itens = rows.slice(0, POR_PAGINA).map((row) => normalizar(r, row));
  return { recurso: metaDe(r), itens, proximo: mais ? String(itens[itens.length - 1].id) : null };
}

export async function obter(r: Recurso, id: number | string): Promise<ItemAdmin | null> {
  const where = [`${idExpr(r)} = $1`];
  const params: unknown[] = [id];
  if (r.filtro) where.push(r.filtro);
  if (r.chavesOcultas) { params.push(CHAVES_OCULTAS); where.push(`${idExpr(r)} !~* $2`); }
  const { rows } = await query(`${selecao(r)} WHERE ${where.join(' AND ')}`, params);
  return rows[0] ? normalizar(r, rows[0]) : null;
}

// ---------- Registro de ações ----------
type Q = typeof query;

export async function registrar(
  q: Q, me: Pick<SessionUser, 'id' | 'name'>, acao: string, recurso: string, alvoId: string | number | null, detalhe: string | null,
): Promise<void> {
  await q(
    `INSERT INTO admin_log (user_id, quem, acao, recurso, alvo_id, detalhe) VALUES ($1, $2, $3, $4, $5, $6)`,
    [me.id, me.name, acao, recurso, alvoId == null ? null : String(alvoId), detalhe ? detalhe.slice(0, 500) : null],
  );
}

/** Para ações que já gravaram em outro lugar: o log não derruba a resposta (a senha temporária só sai uma vez). */
export async function registrarSemFalhar(
  me: Pick<SessionUser, 'id' | 'name'>, acao: string, recurso: string, alvoId: string | number | null, detalhe: string | null,
): Promise<void> {
  try {
    await registrar(query, me, acao, recurso, alvoId, detalhe);
  } catch (err) {
    console.error('[admin] não foi possível registrar no log:', (err as Error).message);
  }
}

// ---------- Edição ----------
function converter(e: EditavelDef, bruto: unknown): { valor: unknown; texto: string } {
  const vazioOk = e.vazio !== undefined;
  const vazioValor = e.vazio === 'nulo' ? null : '';
  if (e.tipo === 'texto' || e.tipo === 'longo') {
    if (typeof bruto !== 'string') throw new HttpError(400, `Valor inválido em ${e.rotulo}.`);
    const s = bruto.trim();
    if (!s) {
      if (!vazioOk) throw new HttpError(400, `Preencha ${e.rotulo}.`);
      return { valor: vazioValor, texto: '(vazio)' };
    }
    const limite = e.limite ?? (e.tipo === 'longo' ? 4000 : 300);
    if (s.length > limite) throw new HttpError(400, `${e.rotulo} passou de ${limite} caracteres.`);
    return { valor: s, texto: s.length > 60 ? `${s.slice(0, 60)}...` : s };
  }
  if (e.tipo === 'bool') {
    if (typeof bruto !== 'boolean') throw new HttpError(400, `Valor inválido em ${e.rotulo}.`);
    return { valor: bruto, texto: bruto ? 'sim' : 'não' };
  }
  if (e.tipo === 'opcao') {
    if (typeof bruto !== 'string' || !e.opcoes?.includes(bruto)) throw new HttpError(400, `Escolha uma opção válida em ${e.rotulo}.`);
    return { valor: bruto, texto: bruto };
  }
  // numero e dinheiro (centavos)
  if (bruto === null || bruto === '') {
    if (!vazioOk) throw new HttpError(400, `Preencha ${e.rotulo}.`);
    return { valor: null, texto: '(vazio)' };
  }
  const n = typeof bruto === 'number' ? bruto : NaN;
  if (!Number.isInteger(n)) throw new HttpError(400, `${e.rotulo} precisa ser um número inteiro.`);
  const min = e.min ?? (e.tipo === 'dinheiro' ? 0 : -2_000_000_000);
  const max = e.max ?? (e.tipo === 'dinheiro' ? 100_000_000 : 2_000_000_000);
  if (n < min || n > max) throw new HttpError(400, `${e.rotulo} precisa ficar entre ${min} e ${max}.`);
  return { valor: n, texto: String(n) };
}

export async function editar(
  r: Recurso, id: number | string, corpo: unknown, me: SessionUser,
): Promise<ItemAdmin> {
  if (!r.editaveis.length) throw new HttpError(403, 'Este item não pode ser editado por aqui.');
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) throw new HttpError(400, 'Dados inválidos.');
  const campos = Object.keys(corpo);
  if (!campos.length) throw new HttpError(400, 'Nada para salvar.');
  if (campos.length > 12) throw new HttpError(400, 'Campos demais.');
  const sets: string[] = [];
  const params: unknown[] = [];
  const resumo: string[] = [];
  for (const campo of campos) {
    const e = r.editaveis.find((x) => x.campo === campo);
    if (!e) throw new HttpError(400, 'Este campo não pode ser editado.');
    const { valor, texto } = converter(e, (corpo as Record<string, unknown>)[campo]);
    params.push(valor);
    sets.push(`${e.coluna ?? e.campo} = ${e.centavosParaReais ? `($${params.length}::numeric / 100)` : `$${params.length}`}`);
    resumo.push(`${e.campo}=${texto}`);
  }
  if (r.aoEditar) sets.push(r.aoEditar);
  params.push(id);
  const where = [`${idCol(r)} = $${params.length}`];
  if (r.chavesOcultas) { params.push(CHAVES_OCULTAS); where.push(`${idCol(r)} !~* $${params.length}`); }
  try {
    await transaction(async (q) => {
      const res = await q(`UPDATE ${r.tabela} SET ${sets.join(', ')} WHERE ${where.join(' AND ')}`, params);
      if (!res.rowCount) throw new HttpError(404, 'Item não encontrado.');
      await registrar(q, me, 'editar', r.id, id, resumo.join('; '));
    });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    erroBanco(err);
  }
  const item = await obter(r, id);
  if (!item) throw new HttpError(404, 'Item não encontrado.');
  return item;
}

// ---------- Exclusão ----------
export async function apagar(r: Recurso, id: number | string, me: SessionUser): Promise<void> {
  if (!r.pode_apagar) throw new HttpError(403, 'Este item não pode ser apagado por aqui.');
  if (r.naoApagarProprio && id === me.id) throw new HttpError(400, 'Você não pode excluir a própria conta.');
  try {
    await transaction(async (q) => {
      const res = await q(`DELETE FROM ${r.tabela} WHERE ${idCol(r)} = $1`, [id]);
      if (!res.rowCount) throw new HttpError(404, 'Item não encontrado.');
      await registrar(q, me, 'apagar', r.id, id, null);
    });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    erroBanco(err);
  }
}

// ---------- Resumo ----------
async function contar(sql: string): Promise<number> {
  const { rows } = await query<{ n: number }>(sql);
  return rows[0]?.n ?? 0;
}

export async function resumo(): Promise<Resumo> {
  const ativos = await disponiveis();
  const ok = await tabelasExistentes();
  const params: unknown[] = [];
  const ramos = ativos.map((r) => {
    params.push(r.id);
    const idp = `$${params.length}`;
    const where: string[] = [];
    if (r.filtro) where.push(r.filtro);
    if (r.chavesOcultas) { params.push(CHAVES_OCULTAS); where.push(`${idExpr(r)} !~* $${params.length}`); }
    const novos = r.novos ? `count(*) FILTER (WHERE ${r.novos} >= NOW() - INTERVAL '7 days')::int` : '0';
    return `SELECT ${idp}::text AS id, count(*)::int AS total, ${novos} AS novos
      FROM ${r.tabela} ${r.alias}${where.length ? ` WHERE ${where.join(' AND ')}` : ''}`;
  });
  const [linhas, denuncias, pedidos, bingo] = await Promise.all([
    ramos.length ? query<{ id: string; total: number; novos: number }>(ramos.join(' UNION ALL '), params) : Promise.resolve({ rows: [] }),
    ok.has('content_reports') ? contar('SELECT count(*)::int AS n FROM content_reports WHERE resolved_at IS NULL') : 0,
    ok.has('invitation_requests') ? contar(`SELECT count(*)::int AS n FROM invitation_requests WHERE status = 'pendente'`) : 0,
    ok.has('party_bingo_claims') ? contar(`SELECT count(*)::int AS n FROM party_bingo_claims WHERE status = 'pendente'`) : 0,
  ]);
  const porId = new Map(linhas.rows.map((l) => [l.id, l]));
  const grupos = GRUPOS.map((titulo) => ({
    titulo: titulo as string,
    recursos: ativos.filter((r) => r.grupo === titulo).map((r) => ({
      id: r.id, nome: r.nome, total: porId.get(r.id)?.total ?? 0, novos7d: porId.get(r.id)?.novos ?? 0,
    })),
  })).filter((g) => g.recursos.length);
  return {
    grupos,
    ferramentas: FERRAMENTAS.map((f) => ({ ...f })),
    pendencias: { denuncias, pedidos_convite: pedidos, bingo_pendentes: bingo },
  };
}

// ---------- Log ----------
export async function listarLog(cursor: string): Promise<PaginaLog> {
  const { rows: t } = await query<{ existe: boolean }>(`SELECT to_regclass('public.admin_log') IS NOT NULL AS existe`);
  if (!t[0]?.existe) return { itens: [], proximo: null };
  if (cursor && !/^\d{1,18}$/.test(cursor)) throw new HttpError(400, 'Cursor inválido.');
  const { rows } = await query<{ id: string; quando: Date; quem: string; acao: string; recurso: string; alvo_id: string | null; detalhe: string | null }>(
    `SELECT id::text AS id, quando, quem, acao, recurso, alvo_id, detalhe FROM admin_log
      ${cursor ? 'WHERE id < $1' : ''} ORDER BY id DESC LIMIT ${POR_PAGINA + 1}`,
    cursor ? [cursor] : [],
  );
  const itens: LogItem[] = rows.slice(0, POR_PAGINA).map((l) => ({ ...l, quando: l.quando.toISOString() }));
  return { itens, proximo: rows.length > POR_PAGINA ? itens[itens.length - 1].id as string : null };
}
