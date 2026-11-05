import 'server-only';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import type { Attendance, Settings } from './types';

export async function getSettings(): Promise<Settings> {
  const { rows } = await query<{ key: string; value: string }>(
    `SELECT key, value FROM app_settings
      WHERE key IN ('event_title', 'event_date', 'event_place', 'contribution_value')`,
  );
  const values = Object.fromEntries(rows.map(({ key, value }) => [key, value]));
  return {
    event_title: values.event_title ?? 'Ceia de Natal',
    event_date: values.event_date ?? '2026-12-24T20:00:00-03:00',
    event_place: values.event_place ?? '',
    contribution_value: Number(values.contribution_value ?? 50),
  };
}

export async function getAttendance(participantId: number | null): Promise<Attendance> {
  // ano nulo: confirmação de antes da coluna. Continua na edição atual até a pessoa responder de novo.
  const sqlAtual = `SELECT a.participant_id, p.name, u.avatar_url, a.status,
            COALESCE(a.adultos, CASE WHEN a.status = 'no' THEN 0 ELSE 1 END)::int AS adultos,
            COALESCE(a.criancas, 0)::int AS criancas
       FROM family_attendance a
       JOIN participants p ON p.id = a.participant_id
       LEFT JOIN family_users u ON u.id = p.user_id
      WHERE a.status IN ('yes', 'maybe', 'no')
        AND (a.ano IS NULL OR a.ano = $1)
      ORDER BY p.name, p.id`;
  const sqlAntigo = `SELECT a.participant_id, p.name, u.avatar_url, a.status
       FROM family_attendance a
       JOIN participants p ON p.id = a.participant_id
       LEFT JOIN family_users u ON u.id = p.user_id
      WHERE a.status IN ('yes', 'maybe', 'no')
      ORDER BY p.name, p.id`;
  let people: Attendance['people'];
  try {
    people = (await query<Attendance['people'][number]>(sqlAtual, [edicaoAtual()])).rows;
  } catch (error) {
    const codigo = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: unknown }).code : undefined;
    if (codigo !== '42703') throw error;
    people = (await query<Attendance['people'][number]>(sqlAntigo)).rows;
  }
  const counts: Attendance['counts'] = { yes: 0, maybe: 0, no: 0 };
  for (const person of people) counts[person.status]++;
  return { mine: people.find((person) => person.participant_id === participantId)?.status ?? null, counts, people };
}
