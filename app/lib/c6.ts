import https from 'node:https';
import { randomInt } from 'node:crypto';

// Cliente do C6 Bank (BolePIX), conta da SpeedTech. Adaptado do ContractHub, que está em produção.
// - mTLS em TODA chamada (auth inclusive); certificado e chave em base64 nas envs.
// - Token em memória, renovado 60 s antes de expirar ou uma vez depois de 401.
// - Nunca logar client_secret, token, chave privada ou CPF.
// - SEM webhook: a conta tem um único webhook (BANK_SLIP_PIX) e ele é do ContractHub.
//   O status é consultado na API (GET /v2/bank_slips/<ref>) e conciliado por cron.

const API_URL = process.env.C6_API_URL || 'https://baas-api.c6bank.info';
const TIMEOUT_MS = 30_000;
const PARTNER = 'NatalEmFamilia';

export class ErroC6 extends Error {
  readonly status: number;
  constructor(status: number, detalhe: string) {
    super(status > 0 ? `C6 respondeu ${status}: ${detalhe}` : detalhe);
    this.status = status;
  }
}

export function c6Configurado(): boolean {
  return Boolean(
    process.env.C6_CLIENT_ID && process.env.C6_CLIENT_SECRET && process.env.C6_CERT_B64 && process.env.C6_KEY_B64,
  );
}

let agenteAtual: https.Agent | null = null;
function agente(): https.Agent {
  if (agenteAtual) return agenteAtual;
  const dec = (v: string | undefined) => Buffer.from((v || '').replace(/\s/g, ''), 'base64').toString('utf8');
  const cert = dec(process.env.C6_CERT_B64);
  const key = dec(process.env.C6_KEY_B64);
  if (!cert.includes('BEGIN') || !key.includes('BEGIN')) throw new ErroC6(0, 'Certificado do C6 inválido nas envs.');
  agenteAtual = new https.Agent({ cert, key, keepAlive: true, maxSockets: 4 });
  return agenteAtual;
}

function redigir(texto: string): string {
  return texto
    .replace(/("(?:tax_id|client_secret|access_token|client_id|key)"\s*:\s*")[^"]*/gi, '$1[redigido]')
    .replace(/\b\d{11}\b/g, '[doc]')
    .replace(/\b\d{14}\b/g, '[doc]')
    .slice(0, 300);
}

function pedir(url: URL, metodo: string, headers: Record<string, string>, corpo?: Buffer) {
  return new Promise<{ status: number; body: Buffer }>((resolve, reject) => {
    const req = https.request(
      { hostname: url.hostname, port: url.port || 443, path: url.pathname + url.search, method: metodo, headers, agent: agente() },
      (res) => {
        const partes: Buffer[] = [];
        res.on('data', (c: Buffer) => partes.push(c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(partes) }));
      },
    );
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error('Tempo esgotado ao falar com o C6.')));
    req.on('error', reject);
    if (corpo?.length) req.write(corpo);
    req.end();
  });
}

let cache: { token: string; expiraEm: number } | null = null;
let emVoo: Promise<string> | null = null;

async function token(forcar = false): Promise<string> {
  if (!forcar && cache && Date.now() < cache.expiraEm - 60_000) return cache.token;
  if (!forcar && emVoo) return emVoo;
  const voo = (async () => {
    const form = Buffer.from(
      new URLSearchParams({
        client_id: process.env.C6_CLIENT_ID || '',
        client_secret: process.env.C6_CLIENT_SECRET || '',
        grant_type: 'client_credentials',
      }).toString(),
    );
    const res = await pedir(new URL('/v1/auth/', API_URL), 'POST', {
      Accept: '*/*',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': String(form.length),
      'partner-software-name': PARTNER,
    }, form);
    const texto = res.body.toString('utf8');
    if (res.status < 200 || res.status >= 300) throw new ErroC6(res.status, redigir(texto) || 'falha na autenticação');
    const json = JSON.parse(texto) as { access_token?: string; expires_in?: number };
    if (!json.access_token) throw new ErroC6(res.status, 'autenticação sem token');
    cache = { token: json.access_token, expiraEm: Date.now() + (Number(json.expires_in) || 600) * 1000 };
    return json.access_token;
  })();
  emVoo = voo;
  try {
    return await voo;
  } finally {
    if (emVoo === voo) emVoo = null;
  }
}

async function requisitar(caminho: string, opts: { metodo?: string; corpo?: unknown; query?: Record<string, string | number> } = {}, renovou = false): Promise<{ status: number; body: Buffer }> {
  const url = new URL(caminho, API_URL);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, String(v));
  // O C6 dá 501 para Accept: application/json e 406 para application/pdf: use */*.
  const headers: Record<string, string> = {
    Accept: '*/*',
    Authorization: `Bearer ${await token(renovou)}`,
    'partner-software-name': PARTNER,
  };
  let corpo: Buffer | undefined;
  if (opts.corpo !== undefined) {
    corpo = Buffer.from(JSON.stringify(opts.corpo));
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = String(corpo.length);
  }
  const res = await pedir(url, opts.metodo ?? 'GET', headers, corpo);
  if (res.status === 401 && !renovou) {
    cache = null;
    return requisitar(caminho, opts, true);
  }
  if (res.status < 200 || res.status >= 300) throw new ErroC6(res.status, redigir(res.body.toString('utf8')) || 'sem detalhe');
  return res;
}

async function json<T>(caminho: string, opts?: Parameters<typeof requisitar>[1]): Promise<T> {
  const texto = (await requisitar(caminho, opts)).body.toString('utf8').trim();
  return (texto ? JSON.parse(texto) : undefined) as T;
}

// ---------------- Boletos ----------------

export interface Boleto {
  referencia: string;
  status: string; // CREATED, REGISTERED, PAID, CANCELED, EXPIRED...
  valor: number | null;
  vencimento: string | null;
  linhaDigitavel: string | null;
  pixCopiaCola: string | null;
}

function lerBoleto(bruto: any, refPadrao = ''): Boleto {
  const pm = bruto?.payment_method ?? {};
  const valor = Number(String(bruto?.amount ?? '').replace(',', '.'));
  return {
    referencia: bruto?.external_reference_id || refPadrao,
    status: String(bruto?.status || 'CREATED').toUpperCase(),
    valor: Number.isFinite(valor) && valor > 0 ? valor : null,
    vencimento: bruto?.due_date ?? null,
    linhaDigitavel: pm?.bank_slip?.digitable_line ?? null,
    pixCopiaCola: pm?.pix?.qr_code ?? null,
  };
}

/** Referência exigida pelo C6: exatamente 26 caracteres [A-Z0-9]. Prefixo NF identifica o Natal. */
export function novaReferencia(): string {
  const alfa = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = 'NF';
  for (let i = 0; i < 24; i++) s += alfa[randomInt(alfa.length)];
  return s;
}

export interface Pagador {
  nome: string;
  cpf: string; // só dígitos, já validado
  email?: string | null;
  endereco: { logradouro: string; bairro: string; cidade: string; uf: string; cep: string };
}

export async function emitirBolePix(input: {
  referencia: string;
  valor: number;
  vencimento: string; // YYYY-MM-DD, hoje ou depois (fuso de Brasília)
  descricao: string;
  pagador: Pagador;
}): Promise<Boleto> {
  const chave = process.env.C6_PIX_CHAVE;
  const email = input.pagador.email?.trim().toLowerCase();
  const corpo = {
    external_reference_id: input.referencia,
    amount: Math.round(input.valor * 100) / 100,
    due_date: input.vencimento,
    description: input.descricao.slice(0, 100),
    payer: {
      name: input.pagador.nome.slice(0, 40),
      tax_id: input.pagador.cpf,
      ...(email && email.length <= 70 && email.includes('@') ? { email } : {}),
      address: {
        address: input.pagador.endereco.logradouro.slice(0, 40),
        neighborhood: input.pagador.endereco.bairro.slice(0, 40),
        city: input.pagador.endereco.cidade.slice(0, 40),
        state: input.pagador.endereco.uf,
        zip_code: input.pagador.endereco.cep,
      },
    },
    payment_method: {
      bank_slip: { billing_scheme: API_URL.includes('sandbox') ? '21' : '15' },
      ...(chave ? { pix: { type: 'EVP', key: chave } } : {}),
    },
    origin: PARTNER,
  };
  return lerBoleto(await json('/v2/bank_slips', { metodo: 'POST', corpo }), input.referencia);
}

export async function consultarBoleto(referencia: string): Promise<Boleto> {
  return lerBoleto(await json(`/v2/bank_slips/${encodeURIComponent(referencia)}`), referencia);
}

export async function pdfBoleto(referencia: string): Promise<Buffer> {
  return (await requisitar(`/v2/bank_slips/${encodeURIComponent(referencia)}/pdf`)).body;
}

/** Boletos pagos entre duas datas (YYYY-MM-DD). Usado na conciliação. */
export async function listarPagos(de: string, ate: string): Promise<Boleto[]> {
  const todos: Boleto[] = [];
  for (let page = 0; page < 50; page++) {
    const res = await json<{ content?: unknown[]; total_pages?: number }>('/v2/bank_slips', {
      query: { status: 'PAID', payment_date_from: de, payment_date_to: ate, page, size: 100 },
    });
    const itens = Array.isArray(res?.content) ? res.content : [];
    for (const it of itens) todos.push(lerBoleto(it));
    if (itens.length === 0 || page + 1 >= (res?.total_pages ?? 1)) break;
  }
  return todos;
}

// ---------------- Utilidades ----------------

export function cpfValido(valor: string): string | null {
  const d = valor.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return null;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]) ? d : null;
}

/** Data de hoje em Brasília somada de N dias, no formato YYYY-MM-DD. */
export function diaSP(somarDias = 0): string {
  const d = new Date(Date.now() + somarDias * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}
