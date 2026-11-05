import { HttpError, ok, readJson, requireUser, route } from '@/app/lib/api';
import { query } from '@/app/lib/db';

export const runtime = 'nodejs';

function parseToken(body: unknown): string {
  const token = body && typeof body === 'object' && 'token' in body ? body.token : null;
  if (typeof token !== 'string' || !token.trim() || token.length > 512 || /\s/.test(token)) {
    throw new HttpError(400, 'Token do aparelho inválido (máximo de 512 caracteres).');
  }
  return token;
}

export const POST = route(async (req) => {
  const me = await requireUser();
  const body = await readJson<unknown>(req);
  const token = parseToken(body);
  const platform = body && typeof body === 'object' && 'platform' in body ? body.platform : null;
  if (platform !== 'ios' && platform !== 'android') {
    throw new HttpError(400, 'Plataforma inválida. Use ios ou android.');
  }
  await query(
    `INSERT INTO push_devices (user_id, platform, token) VALUES ($1, $2, $3)
     ON CONFLICT (token) DO UPDATE
       SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform,
           last_seen_at = NOW(), disabled_at = NULL`,
    [me.id, platform, token],
  );
  return ok({ ok: true });
});

export const DELETE = route(async (req) => {
  const me = await requireUser();
  const token = parseToken(await readJson<unknown>(req));
  await query('DELETE FROM push_devices WHERE token = $1 AND user_id = $2', [token, me.id]);
  return ok({ ok: true });
});
