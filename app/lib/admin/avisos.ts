import { cleanText, HttpError } from '@/app/lib/api';
import { registrar } from '@/app/lib/admin/consulta';
import { query, transaction } from '@/app/lib/db';
import { enviarPush } from '@/app/lib/push';
import type { SessionUser } from '@/app/lib/session';
import type { AvisoAgendado } from './painel-tipos';

type Linha = {
  id: number;
  titulo: string;
  corpo: string;
  rota: string | null;
  user_ids: number[] | null;
  enviar_em: Date | string;
  enviado_em: Date | string | null;
  criado_por_nome: string | null;
};

function iso(valor: Date | string | null): string | null {
  if (valor == null) return null;
  if (valor instanceof Date) return valor.toISOString();
  const d = new Date(valor);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function idsDe(valor: unknown): number[] | null {
  if (valor == null) return null;
  if (!Array.isArray(valor)) return [];
  return valor.map(Number).filter((n) => Number.isInteger(n) && n > 0);
}

function mapear(linha: Linha): AvisoAgendado {
  const ids = idsDe(linha.user_ids);
  return {
    id: Number(linha.id),
    titulo: linha.titulo,
    corpo: linha.corpo,
    rota: linha.rota,
    todos: ids == null,
    pessoas: ids == null ? null : ids.length,
    enviar_em: iso(linha.enviar_em) ?? '',
    enviado_em: iso(linha.enviado_em),
    criado_por_nome: linha.criado_por_nome,
  };
}

async function tabelaExiste(): Promise<boolean> {
  const { rows } = await query<{ existe: boolean }>(
    `SELECT to_regclass('public.admin_scheduled_pushes') IS NOT NULL AS existe`,
  );
  return rows[0]?.existe === true;
}

function semTabela(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === '42P01';
}

/** Data e hora de São Paulo, no formato do input datetime-local: AAAA-MM-DDTHH:mm. */
export function lerHorarioSP(valor: unknown): Date {
  if (typeof valor !== 'string') throw new HttpError(400, 'Informe a data e a hora.');
  const m = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/.exec(valor.trim());
  if (!m) throw new HttpError(400, 'Informe a data e a hora.');
  const [, ano, mes, dia, hora, minuto] = m;
  const calendario = new Date(`${ano}-${mes}-${dia}T00:00:00Z`);
  if (calendario.toISOString().slice(0, 10) !== `${ano}-${mes}-${dia}`) throw new HttpError(400, 'Data inválida.');
  const data = new Date(`${ano}-${mes}-${dia}T${hora}:${minuto}:00-03:00`);
  if (!Number.isFinite(data.getTime())) throw new HttpError(400, 'Data e hora inválidas.');
  if (data.getTime() < Date.now() - 60_000) throw new HttpError(400, 'Escolha um horário que ainda não passou.');
  const limite = Date.now() + 400 * 24 * 60 * 60 * 1000;
  if (data.getTime() > limite) throw new HttpError(400, 'Escolha um horário dentro dos próximos 400 dias.');
  return data;
}

function lerRota(valor: unknown): string | null {
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor !== 'string' || !/^\/[A-Za-z0-9\-_/]{0,100}$/.test(valor) || valor.startsWith('//')) {
    throw new HttpError(400, 'A tela de destino precisa começar com / (por exemplo /mural).');
  }
  return valor;
}

function lerPessoas(valor: unknown): number[] | null {
  if (valor === undefined || valor === null) return null;
  if (!Array.isArray(valor) || valor.length === 0 || valor.length > 500) {
    throw new HttpError(400, 'Lista de pessoas inválida.');
  }
  const ids = [...new Set(valor.map((v) => Number(v)))];
  if (ids.some((n) => !Number.isInteger(n) || n <= 0)) throw new HttpError(400, 'Lista de pessoas inválida.');
  return ids;
}

export async function listarAvisos(): Promise<{ ativo: boolean; pendentes: AvisoAgendado[]; enviados: AvisoAgendado[] }> {
  if (!(await tabelaExiste())) return { ativo: false, pendentes: [], enviados: [] };
  const sql = `SELECT a.id, a.titulo, a.corpo, a.rota, a.user_ids, a.enviar_em, a.enviado_em, u.name AS criado_por_nome
                 FROM admin_scheduled_pushes a
                 LEFT JOIN family_users u ON u.id = a.criado_por`;
  const [pendentes, enviados] = await Promise.all([
    query<Linha>(`${sql} WHERE a.enviado_em IS NULL ORDER BY a.enviar_em, a.id`),
    query<Linha>(`${sql} WHERE a.enviado_em IS NOT NULL ORDER BY a.enviado_em DESC, a.id DESC LIMIT 40`),
  ]);
  return { ativo: true, pendentes: pendentes.rows.map(mapear), enviados: enviados.rows.map(mapear) };
}

export async function criarAviso(me: SessionUser, corpo: Record<string, unknown>): Promise<AvisoAgendado> {
  const titulo = cleanText(corpo.titulo, 'o título', 80);
  const texto = cleanText(corpo.corpo, 'a mensagem', 240);
  const rota = lerRota(corpo.rota);
  const pessoas = lerPessoas(corpo.user_ids);
  const quando = lerHorarioSP(corpo.enviar_em);
  try {
    return await transaction(async (q) => {
      const { rows } = await q<Linha>(
        `INSERT INTO admin_scheduled_pushes (titulo, corpo, rota, user_ids, enviar_em, criado_por)
         VALUES ($1, $2, $3, $4::int[], $5, $6)
         RETURNING id, titulo, corpo, rota, user_ids, enviar_em, enviado_em,
                   (SELECT name FROM family_users WHERE id = $6) AS criado_por_nome`,
        [titulo, texto, rota, pessoas, quando.toISOString(), me.id],
      );
      const aviso = rows[0];
      if (!aviso) throw new HttpError(500, 'Não foi possível agendar.');
      await registrar(q, me, 'agendar', 'aviso_agendado', aviso.id, `"${titulo}" em ${quando.toISOString()}`);
      return mapear(aviso);
    });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (semTabela(err)) throw new HttpError(503, 'Os avisos agendados ainda não estão ativos.');
    const code = (err as { code?: string }).code;
    if (code === '23514' || code === '23502') throw new HttpError(400, 'Não foi possível salvar o aviso.');
    throw err;
  }
}

export async function cancelarAviso(me: SessionUser, id: number): Promise<void> {
  try {
    await transaction(async (q) => {
      const { rows } = await q<{ id: number; titulo: string }>(
        `DELETE FROM admin_scheduled_pushes WHERE id = $1 AND enviado_em IS NULL RETURNING id, titulo`,
        [id],
      );
      if (!rows.length) {
        const { rows: existe } = await q<{ enviado_em: Date | null }>(
          `SELECT enviado_em FROM admin_scheduled_pushes WHERE id = $1`,
          [id],
        );
        if (!existe.length) throw new HttpError(404, 'Aviso não encontrado.');
        throw new HttpError(409, 'Este aviso já foi enviado.');
      }
      await registrar(q, me, 'cancelar', 'aviso_agendado', id, rows[0].titulo);
    });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (semTabela(err)) throw new HttpError(503, 'Os avisos agendados ainda não estão ativos.');
    throw err;
  }
}

type Vencido = {
  id: number;
  titulo: string;
  corpo: string;
  rota: string | null;
  user_ids: number[] | null;
  criado_por: number | null;
  quem: string | null;
};

async function destinos(userIds: number[] | null): Promise<number[]> {
  if (userIds == null) {
    const { rows } = await query<{ id: number }>(`SELECT id FROM family_users`);
    return rows.map((r) => r.id);
  }
  if (!userIds.length) return [];
  const { rows } = await query<{ id: number }>(
    `SELECT id FROM family_users WHERE id = ANY($1::int[])`,
    [userIds],
  );
  return rows.map((r) => r.id);
}

/** Marca os vencidos numa tacada só (UPDATE ... RETURNING) para dois crons não enviarem o mesmo aviso. */
export async function enviarVencidos(): Promise<string> {
  if (!(await tabelaExiste())) return 'Avisos agendados: tabela ainda não existe.';
  const vencidos = await transaction(async (q) => {
    const { rows } = await q<Vencido>(
      `WITH fila AS (
         SELECT id FROM admin_scheduled_pushes
          WHERE enviado_em IS NULL AND enviar_em <= NOW()
          ORDER BY enviar_em, id
          FOR UPDATE SKIP LOCKED
       )
       UPDATE admin_scheduled_pushes AS a
          SET enviado_em = NOW()
         FROM fila
        WHERE a.id = fila.id
       RETURNING a.id, a.titulo, a.corpo, a.rota, a.user_ids, a.criado_por,
                 (SELECT u.name FROM family_users u WHERE u.id = a.criado_por) AS quem`,
    );
    return rows;
  });
  if (!vencidos.length) return 'Avisos agendados: nenhum vencido.';
  let enviados = 0;
  for (const aviso of vencidos) {
    try {
      const ids = idsDe(aviso.user_ids);
      const destino = await destinos(ids);
      if (destino.length) {
        await enviarPush(destino, {
          titulo: aviso.titulo,
          corpo: aviso.corpo,
          ...(aviso.rota ? { rota: aviso.rota } : {}),
        });
      }
      await query(
        `INSERT INTO admin_log (user_id, quem, acao, recurso, alvo_id, detalhe)
         VALUES ($1, $2, 'enviar', 'aviso_agendado', $3, $4)`,
        [
          aviso.criado_por,
          aviso.quem || 'sistema',
          String(aviso.id),
          `"${aviso.titulo}" para ${ids == null ? 'todos' : `${destino.length} pessoa(s)`}`,
        ],
      );
      enviados++;
    } catch (err) {
      console.error('[avisos-agendados]', aviso.id, err instanceof Error ? err.message : 'falha');
    }
  }
  return `Avisos agendados: ${enviados} enviado(s).`;
}
