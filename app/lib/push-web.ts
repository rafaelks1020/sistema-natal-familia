// Lógica pura do Web Push: validar a PushSubscription, achar duplicata pelo endpoint
// e decidir se o navegador pode pedir permissão. Sem banco, sem rede, sem `window`.

export const TOKEN_WEB_MAX = 4096;

export type AssinaturaWeb = {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
};

export type ResultadoAssinatura =
  | { ok: true; assinatura: AssinaturaWeb; token: string }
  | { ok: false; erro: string };

export type AmbientePush = {
  userAgent: string;
  maxTouchPoints: number;
  platform: string;
  capacitorNativo: boolean;
  reactNativeWebView: boolean;
  standalone: boolean;
  temServiceWorker: boolean;
  temPushManager: boolean;
  temNotification: boolean;
};

/** oculto: casca nativa. iphone-instalar: Safari fora da Tela de Início. */
export type ModoPush = 'oculto' | 'iphone-instalar' | 'pronto' | 'sem-suporte';

type ChavesVapid = { publicKey?: string | null; privateKey?: string | null; subject?: string | null };

export function vapidPronto(env: ChavesVapid): boolean {
  const pub = env.publicKey?.trim() ?? '';
  const priv = env.privateKey?.trim() ?? '';
  const subject = env.subject?.trim() ?? '';
  return pub.length >= 80 && priv.length >= 20 && /^mailto:[^\s@]+@[^\s@]+$/.test(subject);
}

export function ehIos(a: Pick<AmbientePush, 'userAgent' | 'platform' | 'maxTouchPoints'>): boolean {
  if (/iPad|iPhone|iPod/.test(a.userAgent)) return true;
  // iPadOS 13+ se apresenta como Mac, mas continua exigindo o app na Tela de Início.
  return a.platform === 'MacIntel' && a.maxTouchPoints > 1;
}

export function modoPush(a: AmbientePush): ModoPush {
  if (a.capacitorNativo || a.reactNativeWebView) return 'oculto';
  if (ehIos(a) && !a.standalone) return 'iphone-instalar';
  if (!a.temServiceWorker || !a.temPushManager || !a.temNotification) return 'sem-suporte';
  return 'pronto';
}

// Só os serviços de push dos navegadores: o servidor faz POST assinado para o endpoint, então
// aceitar qualquer host abriria espaço para o site ser usado contra endereços de terceiros.
const HOSTS_PUSH = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/];
export function hostDePushConhecido(host: string): boolean {
  const h = host.toLowerCase();
  return HOSTS_PUSH.some((re) => re.test(h));
}

function endpointHttps(valor: string): boolean {
  if (valor.length < 12 || valor.length > 2000 || /\s/.test(valor)) return false;
  try {
    const url = new URL(valor);
    return url.protocol === 'https:' && hostDePushConhecido(url.hostname);
  } catch {
    return false;
  }
}

function chaveOk(valor: unknown): valor is string {
  return typeof valor === 'string' && /^[A-Za-z0-9\-_]{16,200}={0,2}$/.test(valor);
}

/** Converte a chave pública VAPID (base64url) para o formato do pushManager.subscribe. */
export function urlBase64ParaBytes(base64url: string): Uint8Array<ArrayBuffer> | null {
  if (typeof base64url !== 'string' || !/^[A-Za-z0-9\-_]+$/.test(base64url)) return null;
  try {
    const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
    const b64 = (base64url + pad).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b64);
    if (!raw.length) return null;
    const buffer = new ArrayBuffer(raw.length);
    const out = new Uint8Array(buffer);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export function parseAssinatura(valor: unknown): ResultadoAssinatura {
  let bruto = valor;
  if (typeof valor === 'string') {
    if (valor.length > TOKEN_WEB_MAX) return { ok: false, erro: 'Assinatura grande demais.' };
    try {
      bruto = JSON.parse(valor) as unknown;
    } catch {
      return { ok: false, erro: 'Assinatura inválida.' };
    }
  }
  if (!bruto || typeof bruto !== 'object') return { ok: false, erro: 'Assinatura inválida.' };
  const obj = bruto as Record<string, unknown>;
  if (typeof obj.endpoint !== 'string' || !endpointHttps(obj.endpoint)) {
    return { ok: false, erro: 'Endereço da assinatura inválido.' };
  }
  if (!obj.keys || typeof obj.keys !== 'object') return { ok: false, erro: 'Chaves da assinatura inválidas.' };
  const keys = obj.keys as Record<string, unknown>;
  if (!chaveOk(keys.p256dh) || !chaveOk(keys.auth)) return { ok: false, erro: 'Chaves da assinatura inválidas.' };
  let expirationTime: number | null;
  if (obj.expirationTime === null || obj.expirationTime === undefined) expirationTime = null;
  else if (typeof obj.expirationTime === 'number' && Number.isFinite(obj.expirationTime)) expirationTime = obj.expirationTime;
  else return { ok: false, erro: 'Validade da assinatura inválida.' };
  const assinatura: AssinaturaWeb = {
    endpoint: obj.endpoint,
    expirationTime,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
  };
  const token = JSON.stringify(assinatura);
  if (token.length > TOKEN_WEB_MAX) return { ok: false, erro: 'Assinatura grande demais.' };
  return { ok: true, assinatura, token };
}

export function endpointDoToken(token: string): string | null {
  const parsed = parseAssinatura(token);
  return parsed.ok ? parsed.assinatura.endpoint : null;
}

/** Ids das linhas cujo token é a mesma assinatura (mesmo endpoint), do menor para o maior. */
export function idsDoEndpoint(linhas: { id: number; token: string }[], endpoint: string): number[] {
  if (!endpointHttps(endpoint)) return [];
  return linhas
    .filter((linha) => endpointDoToken(linha.token) === endpoint)
    .map((linha) => linha.id)
    .sort((a, b) => a - b);
}

/** Pedaço do endpoint como ele fica dentro do JSON guardado (aspas e barras escapadas). */
export function trechoEndpoint(endpoint: string): string {
  return JSON.stringify(endpoint).slice(1, -1);
}
