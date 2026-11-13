import { sign } from 'node:crypto';
import { connect } from 'node:http2';
import { after } from 'next/server';
import { sendNotification, setVapidDetails, WebPushError } from 'web-push';
import { query } from './db';
import { parseAssinatura, vapidPronto } from './push-web';

type Mensagem = { titulo: string; corpo: string; rota?: string };

// O app e o site dão nomes diferentes a algumas telas: cada aparelho recebe a rota que existe nele.
const DO_APP_PARA_O_SITE: Record<string, string> = {
  '/festa-quiz': '/festa/quiz', '/festa-bingo': '/festa/bingo', '/festa-enquete': '/festa/enquete',
  '/festa-desafio': '/festa/desafio', '/festa-foto-oficial': '/festa/foto-oficial',
  '/amigo-oculto-ao-vivo': '/amigo-oculto/ao-vivo',
};
const DO_SITE_PARA_O_APP: Record<string, string> = {
  ...Object.fromEntries(Object.entries(DO_APP_PARA_O_SITE).map(([app, site]) => [site, app])),
  // Telas que só o site tem: no app, a mais próxima.
  '/missoes': '/conquistas', '/pontos': '/conquistas', '/karaoke': '/natal', '/admin/notificacoes': '/admin',
};
export const rotaDoSite = (rota: string) => DO_APP_PARA_O_SITE[rota] ?? rota;
export const rotaDoApp = (rota: string) => DO_SITE_PARA_O_APP[rota] ?? rota;
type Envio = 'ok' | 'invalido' | 'falhou';
export type ResultadoPush = { recebidos: number; falharam: number };
type Device = { id: number; user_id: number; platform: 'ios' | 'android' | 'web'; token: string; last_seen_at: string };
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

async function sendAndroid(device: Device, msg: Mensagem): Promise<Envio> {
  const key = process.env.FCM_SERVICE_ACCOUNT_B64;
  if (!key) return 'falhou';
  const account = JSON.parse(Buffer.from(key, 'base64').toString('utf8')) as ServiceAccount;
  if (!account.project_id || !account.client_email || !account.private_key) throw new Error('Conta FCM inválida');
  const token = await accessToken(account, key);
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: {
      token: device.token,
      notification: { title: msg.titulo, body: msg.corpo },
      ...(msg.rota ? { data: { rota: rotaDoApp(msg.rota) } } : {}),
    } }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.ok) return 'ok';
  if (response.status === 401) fcmCache = undefined;
  const data = await response.json() as { error?: { status?: string; details?: { errorCode?: string }[] } };
  const codes = [data.error?.status, ...(data.error?.details ?? []).map((item) => item.errorCode)];
  if (codes.some((code) => code === 'UNREGISTERED' || code === 'NOT_FOUND')) return 'invalido';
  console.error('[push:android] HTTP', response.status);
  return 'falhou';
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

async function sendIos(device: Device, msg: Mensagem): Promise<Envio> {
  if (!apnsConfigured()) return 'falhou';
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
        ...(msg.rota ? { rota: rotaDoApp(msg.rota) } : {}),
      }));
    } catch (error) {
      finish(error instanceof Error ? error : new Error('Falha APNs'));
    }
  });
  if (result.status === 200) return 'ok';
  const data = result.body ? JSON.parse(result.body) as { reason?: string } : {};
  if (result.status === 410 || data.reason === 'BadDeviceToken') return 'invalido';
  console.error('[push:ios] HTTP', result.status);
  return 'falhou';
}

function webConfigurado(): boolean {
  return vapidPronto({
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT,
  });
}

async function sendWeb(device: Device, msg: Mensagem): Promise<Envio> {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return 'falhou';
  const parsed = parseAssinatura(device.token);
  // JSON quebrado nunca vai entregar. Desativa como token inválido.
  if (!parsed.ok) return 'invalido';
  try {
    setVapidDetails(subject, publicKey, privateKey);
    await sendNotification(parsed.assinatura, JSON.stringify({
      titulo: msg.titulo,
      corpo: msg.corpo,
      ...(msg.rota ? { rota: rotaDoSite(msg.rota) } : {}),
    }), { timeout: TIMEOUT_MS, TTL: 12 * 60 * 60 });
    return 'ok';
  } catch (error) {
    const status = error instanceof WebPushError ? error.statusCode : undefined;
    // 404 e 410: a assinatura morreu. Mesma saída dos tokens nativos inválidos.
    if (status === 404 || status === 410) return 'invalido';
    console.error('[push:web] HTTP', status ?? 'erro');
    return 'falhou';
  }
}

function enviar(device: Device, msg: Mensagem): Promise<Envio> {
  if (device.platform === 'android') return sendAndroid(device, msg);
  if (device.platform === 'web') return sendWeb(device, msg);
  return sendIos(device, msg);
}

function plataformasConfiguradas(): string[] {
  return [
    ...(process.env.FCM_SERVICE_ACCOUNT_B64 ? ['android'] : []),
    ...(apnsConfigured() ? ['ios'] : []),
    ...(webConfigurado() ? ['web'] : []),
  ];
}

async function dispatch(userIds: number[], msg: Mensagem, platforms: string[]): Promise<ResultadoPush> {
  const { rows } = await query<Device>(
    `SELECT id, user_id, platform, token, last_seen_at::text AS last_seen_at FROM push_devices
      WHERE user_id = ANY($1::int[]) AND disabled_at IS NULL AND platform = ANY($2::text[])`,
    [[...new Set(userIds)], platforms],
  );
  let recebidos = 0;
  let falharam = 0;
  // Limita conexões de rede e ao banco sem serializar todos os aparelhos.
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(5, rows.length) }, async () => {
    while (next < rows.length) {
      const device = rows[next++];
      try {
        const envio = await enviar(device, msg);
        if (envio === 'ok') {
          recebidos += 1;
          continue;
        }
        falharam += 1;
        if (envio === 'invalido') {
          // Um novo registro ou troca de dono durante o envio prevalece sobre esta resposta.
          await query(
            `UPDATE push_devices SET disabled_at = NOW()
              WHERE id = $1 AND user_id = $2 AND token = $3 AND last_seen_at = $4::timestamptz`,
            [device.id, device.user_id, device.token, device.last_seen_at],
          );
        }
      } catch (error) {
        falharam += 1;
        logError(device.platform, error);
      }
    }
  }));
  return { recebidos, falharam };
}

/** Envia agora e devolve a contagem. Usado pelo teste do admin. */
export async function enviarPushAgora(userIds: number[], msg: Mensagem): Promise<ResultadoPush> {
  const platforms = plataformasConfiguradas();
  if (!userIds.length || !platforms.length) return { recebidos: 0, falharam: 0 };
  return dispatch(userIds, msg, platforms);
}

/** Agenda após a resposta, mantendo a execução viva na Vercel. Nunca rejeita. */
export async function enviarPush(userIds: number[], msg: Mensagem): Promise<void> {
  try {
    const platforms = plataformasConfiguradas();
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
