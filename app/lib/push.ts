import { sign } from 'node:crypto';
import { connect } from 'node:http2';
import { after } from 'next/server';
import { query } from './db';

type Mensagem = { titulo: string; corpo: string; rota?: string };
type Device = { id: number; user_id: number; platform: 'ios' | 'android'; token: string; last_seen_at: string };
type ServiceAccount = { project_id: string; client_email: string; private_key: string };
const TIMEOUT_MS = 8_000;
const CACHE_MS = 50 * 60 * 1000;
let fcmCache: { key: string; token: string; expires: number } | undefined;
let fcmPending: { key: string; promise: Promise<string> } | undefined;
let apnsCache: { key: string; token: string; expires: number } | undefined;

function logError(platform: string, error: unknown) {
  // Não registrar tokens, chaves ou corpos retornados pelos provedores.
  console.error(`[push:${platform}]`, error instanceof Error ? error.name : 'Falha no envio');
}

function jwtPart(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

async function accessToken(account: ServiceAccount, key: string): Promise<string> {
  if (fcmCache?.key === key && fcmCache.expires > Date.now()) return fcmCache.token;
  if (fcmPending?.key === key) return fcmPending.promise;
  const promise = (async () => {
    const now = Math.floor(Date.now() / 1000);
    const input = `${jwtPart({ alg: 'RS256', typ: 'JWT' })}.${jwtPart({
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
    })}`;
    const assertion = `${input}.${sign('RSA-SHA256', Buffer.from(input), account.private_key).toString('base64url')}`;
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error('Falha na autenticação FCM');
    const data = await response.json() as { access_token?: string; expires_in?: number };
    if (!data.access_token) throw new Error('Resposta OAuth inválida');
    const ttl = Math.min(CACHE_MS, Math.max(0, (Number(data.expires_in ?? 3600) - 60) * 1000));
    fcmCache = { key, token: data.access_token, expires: Date.now() + ttl };
    return data.access_token;
  })();
  fcmPending = { key, promise };
  try {
    return await promise;
  } finally {
    if (fcmPending?.promise === promise) fcmPending = undefined;
  }
}

async function sendAndroid(device: Device, msg: Mensagem): Promise<boolean> {
  const key = process.env.FCM_SERVICE_ACCOUNT_B64;
  if (!key) return false;
  const account = JSON.parse(Buffer.from(key, 'base64').toString('utf8')) as ServiceAccount;
  if (!account.project_id || !account.client_email || !account.private_key) throw new Error('Conta FCM inválida');
  const token = await accessToken(account, key);
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: {
      token: device.token,
      notification: { title: msg.titulo, body: msg.corpo },
      ...(msg.rota ? { data: { rota: msg.rota } } : {}),
    } }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.ok) return false;
  if (response.status === 401) fcmCache = undefined;
  const data = await response.json() as { error?: { status?: string; details?: { errorCode?: string }[] } };
  const codes = [data.error?.status, ...(data.error?.details ?? []).map((item) => item.errorCode)];
  if (codes.some((code) => code === 'UNREGISTERED' || code === 'NOT_FOUND')) return true;
  console.error('[push:android] HTTP', response.status);
  return false;
}

function apnsConfigured(): boolean {
  return Boolean(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_KEY_P8_B64);
}

function apnsJwt(): string {
  const keyId = process.env.APNS_KEY_ID!;
  const teamId = process.env.APNS_TEAM_ID!;
  const encodedKey = process.env.APNS_KEY_P8_B64!;
  const key = `${keyId}:${teamId}:${encodedKey}`;
  if (apnsCache?.key === key && apnsCache.expires > Date.now()) return apnsCache.token;
  const input = `${jwtPart({ alg: 'ES256', kid: keyId })}.${jwtPart({ iss: teamId, iat: Math.floor(Date.now() / 1000) })}`;
  const signature = sign('sha256', Buffer.from(input), {
    key: Buffer.from(encodedKey, 'base64').toString('utf8'), dsaEncoding: 'ieee-p1363',
  }).toString('base64url');
  const token = `${input}.${signature}`;
  apnsCache = { key, token, expires: Date.now() + CACHE_MS };
  return token;
}

async function sendIos(device: Device, msg: Mensagem): Promise<boolean> {
  if (!apnsConfigured()) return false;
  const authorization = `bearer ${apnsJwt()}`;
  const host = process.env.APNS_PRODUCTION === 'true' ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';
  const result = await new Promise<{ status: number; body: string }>((resolve, reject) => {
    const client = connect(`https://${host}`);
    let settled = false;
    const timer = setTimeout(() => finish(new Error('Tempo de envio APNs excedido')), TIMEOUT_MS);
    function finish(error?: Error, result?: { status: number; body: string }) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.destroy();
      if (error) reject(error);
      else resolve(result!);
    }
    client.on('error', (error) => finish(error));
    client.on('close', () => finish(new Error('Conexão APNs encerrada')));
    try {
      const request = client.request({
        ':method': 'POST', ':path': `/3/device/${encodeURIComponent(device.token)}`,
        authorization,
        'apns-topic': process.env.APNS_BUNDLE_ID || 'br.com.natalemfamilia.app',
        'apns-push-type': 'alert', 'apns-priority': '10', 'content-type': 'application/json',
      });
      let status = 0;
      let body = '';
      request.setEncoding('utf8');
      request.on('response', (headers) => { status = Number(headers[':status']); });
      request.on('data', (chunk: string) => { body += chunk; });
      request.on('error', (error) => finish(error));
      request.on('aborted', () => finish(new Error('Envio APNs interrompido')));
      request.on('end', () => finish(undefined, { status, body }));
      request.end(JSON.stringify({
        aps: { alert: { title: msg.titulo, body: msg.corpo }, sound: 'default' },
        ...(msg.rota ? { rota: msg.rota } : {}),
      }));
    } catch (error) {
      finish(error instanceof Error ? error : new Error('Falha APNs'));
    }
  });
  if (result.status === 200) return false;
  const data = result.body ? JSON.parse(result.body) as { reason?: string } : {};
  if (result.status === 410 || data.reason === 'BadDeviceToken') return true;
  console.error('[push:ios] HTTP', result.status);
  return false;
}

async function dispatch(userIds: number[], msg: Mensagem, platforms: string[]) {
  const { rows } = await query<Device>(
    `SELECT id, user_id, platform, token, last_seen_at::text AS last_seen_at FROM push_devices
      WHERE user_id = ANY($1::int[]) AND disabled_at IS NULL AND platform = ANY($2::text[])`,
    [[...new Set(userIds)], platforms],
  );
  // Limita conexões de rede e ao banco sem serializar todos os aparelhos.
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(5, rows.length) }, async () => {
    while (next < rows.length) {
      const device = rows[next++];
      try {
        const invalid = await (device.platform === 'android' ? sendAndroid(device, msg) : sendIos(device, msg));
        if (invalid) {
          // Um novo registro ou troca de dono durante o envio prevalece sobre esta resposta.
          await query(
            `UPDATE push_devices SET disabled_at = NOW()
              WHERE id = $1 AND user_id = $2 AND token = $3 AND last_seen_at = $4::timestamp`,
            [device.id, device.user_id, device.token, device.last_seen_at],
          );
        }
      } catch (error) {
        logError(device.platform, error);
      }
    }
  }));
}

/** Agenda após a resposta, mantendo a execução viva na Vercel. Nunca rejeita. */
export async function enviarPush(userIds: number[], msg: Mensagem): Promise<void> {
  try {
    const platforms = [
      ...(process.env.FCM_SERVICE_ACCOUNT_B64 ? ['android'] : []),
      ...(apnsConfigured() ? ['ios'] : []),
    ];
    if (!userIds.length || !platforms.length) return;
    after(async () => {
      try {
        await dispatch(userIds, msg, platforms);
      } catch (error) {
        logError('envio', error);
      }
    });
  } catch (error) {
    logError('agendamento', error);
  }
}
