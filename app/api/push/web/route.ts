import { HttpError, ok, readJson, requireUser, route } from '@/app/lib/api';
import { query, transaction } from '@/app/lib/db';
import { idsDoEndpoint, parseAssinatura, vapidPronto } from '@/app/lib/push-web';

export const runtime = 'nodejs';

function codigoPg(err: unknown): string {
  return err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
}

function chavePublica(): string | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!vapidPronto({
    publicKey,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT,
  })) return null;
  return publicKey!.trim();
}

export const GET = route(async () => {
  await requireUser();
  return ok({ chavePublica: chavePublica() });
});

export const POST = route(async (req) => {
  const me = await requireUser();
  const parsed = parseAssinatura(await readJson<unknown>(req));
  if (!parsed.ok) throw new HttpError(400, parsed.erro);
  const { endpoint } = parsed.assinatura;
  const token = parsed.token;
  try {
    await transaction(async (q) => {
      // Uma assinatura por navegador. O cadeado evita duas linhas do mesmo endpoint.
      await q('SELECT pg_advisory_xact_lock(hashtext($1))', [`web:${endpoint}`]);
      const { rows } = await q<{ id: number; token: string }>(
        `SELECT id, token FROM push_devices WHERE platform = 'web' ORDER BY id`,
      );
      const ids = idsDoEndpoint(rows, endpoint);
      if (ids.length) {
        await q(
          `UPDATE push_devices
              SET user_id = $1, platform = 'web', token = $2, last_seen_at = NOW(), disabled_at = NULL
            WHERE id = $3`,
          [me.id, token, ids[0]],
        );
        if (ids.length > 1) await q('DELETE FROM push_devices WHERE id = ANY($1::int[])', [ids.slice(1)]);
        return;
      }
      await q(
        'INSERT INTO push_devices (user_id, platform, token) VALUES ($1, \'web\', $2)',
        [me.id, token],
      );
    });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (codigoPg(err) === '23505') {
      const atualizado = await query(
        `UPDATE push_devices
            SET user_id = $1, token = $2, last_seen_at = NOW(), disabled_at = NULL
          WHERE platform = 'web' AND left(token, 1) = '{' AND (token::jsonb ->> 'endpoint') = $3`,
        [me.id, token, endpoint],
      );
      if (atualizado.rowCount) return ok({ ok: true });
    }
    if (codigoPg(err) === '23514') {
      throw new HttpError(503, 'As notificações do site ainda não estão prontas.');
    }
    throw err;
  }
  return ok({ ok: true });
});

export const DELETE = route(async (req) => {
  const me = await requireUser();
  const parsed = parseAssinatura(await readJson<unknown>(req));
  if (!parsed.ok) throw new HttpError(400, parsed.erro);
  const { rows } = await query<{ id: number; token: string }>(
    `SELECT id, token FROM push_devices WHERE platform = 'web' AND user_id = $1`,
    [me.id],
  );
  const ids = idsDoEndpoint(rows, parsed.assinatura.endpoint);
  if (ids.length) await query('DELETE FROM push_devices WHERE user_id = $1 AND id = ANY($2::int[])', [me.id, ids]);
  return ok({ ok: true });
});
