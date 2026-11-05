import { cleanText, HttpError, ok, readJson, requireAdmin, requireUser, route } from '@/app/lib/api';
import { transaction } from '@/app/lib/db';
import { loadTheme } from '../features';
export const dynamic = 'force-dynamic';
export const GET = route(async () => { await requireUser(); return ok(await loadTheme()); });
export const PUT = route(async req => {
  await requireAdmin();
  const body = await readJson<Record<string, unknown>>(req);
  const tema = cleanText(body.tema, 'o tema', 100);
  const valor = body.valor_centavos == null || body.valor_centavos === '' ? null : Number(body.valor_centavos);
  if (valor !== null && (!Number.isSafeInteger(valor) || valor < 0 || valor > 100_000_000)) throw new HttpError(400, 'Valor sugerido inválido.');
  if (typeof body.evitar_repeticao !== 'boolean') throw new HttpError(400, 'Informe a regra do ano anterior.');
  await transaction(async q => {
    for (const [key, value] of [['amigo_tema', tema], ['amigo_valor', valor === null ? '' : String(valor)], ['amigo_evitar_repeticao', String(body.evitar_repeticao)]]) {
      await q('INSERT INTO app_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()', [key, value]);
    }
  });
  return ok({ ok: true });
});
