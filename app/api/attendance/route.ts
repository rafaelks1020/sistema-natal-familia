import { HttpError, ok, readJson, requireUser, route } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { getAttendance } from '@/app/(app)/_inicio/server';

export const GET = route(async () => {
  const me = await requireUser();
  return ok(await getAttendance(me.participant_id));
});

export const POST = route(async (req) => {
  const me = await requireUser();
  if (me.participant_id === null) throw new HttpError(400, 'Seu acesso ainda não está ligado a um participante.');
  const body = await readJson<{ status?: unknown } | null>(req);
  const status = body?.status;
  if (status !== 'yes' && status !== 'maybe' && status !== 'no') {
    throw new HttpError(400, 'Escolha Vou, Talvez ou Não.');
  }
  await query(
    `INSERT INTO family_attendance (participant_id, user_id, status, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (participant_id) DO UPDATE
       SET user_id = EXCLUDED.user_id, status = EXCLUDED.status, updated_at = NOW()`,
    [me.participant_id, me.id, status],
  );
  return ok(await getAttendance(me.participant_id));
});
