import { cleanText, HttpError, ok, readJson, requireAdmin, route } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { consultarMeta } from '../meta';

export const PUT = route(async req => {
  await requireAdmin();
  const body = await readJson<Record<string, unknown>>(req);
  const centavos = body?.meta_centavos;
  if (typeof centavos !== 'number' || !Number.isSafeInteger(centavos) || centavos <= 0 || centavos > 9999999999) {
    throw new HttpError(400, 'Informe uma meta válida em reais, com até duas casas decimais.');
  }
  const destino = cleanText(body.destino, 'o destino do dinheiro', 500);
  await query(`INSERT INTO app_settings(key, value, updated_at)
    SELECT key, value, NOW() FROM jsonb_each_text($1::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
  [JSON.stringify({ vaquinha_meta_centavos: String(centavos), vaquinha_destino: destino, vaquinha_ano: String(edicaoAtual()) })]);
  return ok(await consultarMeta());
});
