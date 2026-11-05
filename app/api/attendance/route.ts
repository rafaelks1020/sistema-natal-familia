import { getAttendance } from '@/app/(app)/_inicio/server';
import { cleanText, HttpError, ok, readJson, requireUser, route } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';

type Status = 'yes' | 'maybe' | 'no';

function semColunaNova(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === '42703';
}

function contagem(value: unknown, campo: string): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  if (!Number.isInteger(n) || n < 0 || n > 40) {
    throw new HttpError(400, `${campo} precisa ser um número inteiro de 0 a 40.`);
  }
  return n;
}

async function salvarAntigo(participantId: number, userId: number, status: Status) {
  await query(
    `INSERT INTO family_attendance (participant_id, user_id, status, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (participant_id) DO UPDATE
       SET user_id = EXCLUDED.user_id, status = EXCLUDED.status, updated_at = NOW()`,
    [participantId, userId, status],
  );
}

async function salvarPresenca(userId: number, participantId: number, status: Status, body: Record<string, unknown>) {
  let prev: { adultos: number | null; criancas: number | null; restricao: string | null } | undefined;
  try {
    const lido = await query<{ adultos: number | null; criancas: number | null; restricao: string | null }>(
      'SELECT adultos, criancas, restricao FROM family_attendance WHERE participant_id = $1',
      [participantId],
    );
    prev = lido.rows.length ? lido.rows[0] : undefined;
  } catch (error) {
    if (!semColunaNova(error)) throw error;
    await salvarAntigo(participantId, userId, status);
    return;
  }

  const enviouAdultos = Object.prototype.hasOwnProperty.call(body, 'adultos') && body.adultos !== null && body.adultos !== undefined;
  const enviouCriancas = Object.prototype.hasOwnProperty.call(body, 'criancas') && body.criancas !== null && body.criancas !== undefined;
  let adultos = enviouAdultos ? contagem(body.adultos, 'Adultos') : (prev?.adultos ?? (status === 'no' ? 0 : 1));
  const criancas = enviouCriancas ? contagem(body.criancas, 'Crianças') : (prev?.criancas ?? 0);
  if (status !== 'no' && adultos + criancas < 1) {
    if (enviouAdultos || enviouCriancas) {
      throw new HttpError(400, 'Diga quantos adultos e crianças vêm. Precisa ter pelo menos 1 pessoa.');
    }
    adultos = 1;
  }
  let restricao = prev?.restricao ?? null;
  if (Object.prototype.hasOwnProperty.call(body, 'restricao')) {
    restricao = cleanText(body.restricao, 'a restrição alimentar', 120, false) || null;
  }
  try {
    await query(
      `INSERT INTO family_attendance (participant_id, user_id, status, adultos, criancas, restricao, ano, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (participant_id) DO UPDATE
         SET user_id = EXCLUDED.user_id,
             status = EXCLUDED.status,
             adultos = EXCLUDED.adultos,
             criancas = EXCLUDED.criancas,
             restricao = EXCLUDED.restricao,
             ano = EXCLUDED.ano,
             updated_at = NOW()`,
      [participantId, userId, status, adultos, criancas, restricao, edicaoAtual()],
    );
  } catch (error) {
    if (!semColunaNova(error)) throw error;
    await salvarAntigo(participantId, userId, status);
  }
}

export const GET = route(async () => {
  const me = await requireUser();
  return ok(await getAttendance(me.participant_id));
});

export const POST = route(async (req) => {
  const me = await requireUser();
  if (me.participant_id === null) throw new HttpError(400, 'Seu acesso ainda não está ligado a um participante.');
  const body = await readJson<Record<string, unknown> | null>(req);
  const status = body?.status;
  if (status !== 'yes' && status !== 'maybe' && status !== 'no') {
    throw new HttpError(400, 'Escolha Vou, Talvez ou Não.');
  }
  await salvarPresenca(me.id, me.participant_id, status, body ?? {});
  return ok(await getAttendance(me.participant_id));
});
