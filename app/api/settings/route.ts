import { cleanText, HttpError, ok, readJson, requireAdmin, requireUser, route } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { getSettings } from '@/app/(app)/_inicio/server';

/** Aceita no máximo 2 casas e devolve o valor já arredondado para gravar. */
export function parseContribution(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) {
    throw new HttpError(400, 'Informe uma contribuição numérica maior ou igual a zero.');
  }
  const rounded = Math.round(raw * 100) / 100;
  if (Math.abs(raw - rounded) > 1e-8) {
    throw new HttpError(400, 'Informe a contribuição com no máximo 2 casas decimais.');
  }
  return rounded;
}

export const GET = route(async () => {
  await requireUser();
  return ok(await getSettings());
});

export const PUT = route(async (req) => {
  await requireAdmin();
  const body = await readJson<Record<string, unknown> | null>(req);
  if (!body || Array.isArray(body) || typeof body !== 'object') throw new HttpError(400, 'Dados inválidos.');
  const event_title = cleanText(body.event_title, 'o nome do evento', 160);
  const event_place = cleanText(body.event_place, 'o local', 500, false);
  const event_date = cleanText(body.event_date, 'a data', 40);
  const parts = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(event_date);
  const calendar = new Date(`${event_date.slice(0, 10)}T00:00:00Z`);
  if (!parts || !Number.isFinite(Date.parse(event_date)) || !Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== event_date.slice(0, 10)) {
    throw new HttpError(400, 'Informe uma data ISO válida com horário e fuso.');
  }
  const contribution_value = parseContribution(body.contribution_value);
  const settings = { event_title, event_date, event_place, contribution_value };
  await query(
    `INSERT INTO app_settings (key, value, updated_at)
     SELECT key, value, NOW() FROM jsonb_each_text($1::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify({ ...settings, contribution_value: contribution_value.toFixed(2) })],
  );
  return ok(settings);
});
