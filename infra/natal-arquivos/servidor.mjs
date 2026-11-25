// Natal em Família: recebe os envios (fotos, vídeos, áudios, instrumentais) e grava na Storage Box da Hetzner (/mnt/storage).
// A leitura pública é do Caddy (file_server em /f/*). Este serviço só cuida de gravar e apagar, sempre com URL assinada pelo site.
// Assinatura: HMAC-SHA256 com chave = HMAC(SESSION_SECRET, 'natal-arquivos-v1'), a mesma conta de app/lib/arquivos.ts.
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { createWriteStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PORTA = Number(process.env.PORTA || 4791);
const RAIZ = process.env.RAIZ || '/mnt/storage/natal-em-familia';
const TEMP = process.env.TEMP_DIR || '/home/rafael/natal-arquivos/tmp';
const SEGREDO = process.env.SESSION_SECRET;
if (!SEGREDO) { console.error('SESSION_SECRET ausente'); process.exit(1); }
const CHAVE = createHmac('sha256', SEGREDO).update('natal-arquivos-v1').digest();
const ORIGENS = new Set(['https://natalemfamilia.com.br', 'https://www.natalemfamilia.com.br', 'http://localhost:3000', 'http://localhost:3999']);

const assinar = (texto) => createHmac('sha256', CHAVE).update(texto).digest('base64url');
function confere(texto, s) {
  const a = Buffer.from(assinar(texto));
  const b = Buffer.from(String(s || ''));
  return a.length === b.length && timingSafeEqual(a, b);
}
/** Caminho relativo seguro: letras, números, -, _, ., / ; sem .. nem barra no começo. */
function caminhoSeguro(p) {
  if (typeof p !== 'string' || p.length > 300 || !/^[A-Za-z0-9][A-Za-z0-9._\/-]*$/.test(p) || p.includes('..') || p.includes('//')) return null;
  return p;
}
function cors(req, res) {
  const o = req.headers.origin;
  if (o && ORIGENS.has(o)) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Methods', 'PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
}
function fim(res, codigo, corpo) {
  res.writeHead(codigo, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(corpo));
}

async function receber(req, res, q) {
  const p = caminhoSeguro(q.get('p'));
  const tipo = q.get('t') || '';
  const max = Number(q.get('max'));
  const exp = Number(q.get('exp'));
  if (!p || !tipo || !Number.isFinite(max) || max <= 0 || !Number.isFinite(exp)) return fim(res, 400, { erro: 'Parâmetros inválidos.' });
  if (!confere(`PUT\n${p}\n${tipo}\n${max}\n${exp}`, q.get('s'))) return fim(res, 403, { erro: 'Assinatura inválida.' });
  if (exp < Date.now() / 1000) return fim(res, 403, { erro: 'Link de envio vencido.' });
  const ct = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (ct !== tipo.split(';')[0].trim().toLowerCase()) return fim(res, 415, { erro: 'Tipo de arquivo diferente do combinado.' });
  const declarado = Number(req.headers['content-length']);
  if (Number.isFinite(declarado) && declarado > max) return fim(res, 413, { erro: 'Arquivo grande demais.' });
  const destino = path.join(RAIZ, p);
  try { await fs.access(destino); return fim(res, 409, { erro: 'Já existe.' }); } catch { /* não existe: segue */ }
  await fs.mkdir(TEMP, { recursive: true });
  const temp = path.join(TEMP, `${Date.now()}-${randomBytes(6).toString('hex')}`);
  let total = 0;
  let estourou = false;
  const out = createWriteStream(temp, { flags: 'wx' });
  await new Promise((resolve, reject) => {
    req.on('data', (c) => {
      total += c.length;
      if (total > max && !estourou) { estourou = true; req.unpipe(out); out.destroy(); req.resume(); resolve(); }
    });
    req.on('error', reject);
    out.on('error', reject);
    out.on('finish', resolve);
    req.pipe(out);
  }).catch(() => { estourou = estourou || 'erro'; });
  if (estourou || total === 0) {
    await fs.rm(temp, { force: true });
    return fim(res, estourou === true ? 413 : 400, { erro: estourou === true ? 'Arquivo grande demais.' : 'Envio vazio ou interrompido.' });
  }
  await fs.mkdir(path.dirname(destino), { recursive: true });
  // Disco local -> Storage Box: copia e só então publica (rename atômico dentro da Storage Box).
  const parcial = `${destino}.parcial-${randomBytes(4).toString('hex')}`;
  try {
    await fs.copyFile(temp, parcial);
    await fs.rename(parcial, destino);
  } catch (e) {
    await fs.rm(parcial, { force: true });
    await fs.rm(temp, { force: true });
    console.error('falha ao gravar', p, e?.code);
    return fim(res, 500, { erro: 'Não consegui gravar no armazenamento.' });
  }
  await fs.rm(temp, { force: true });
  return fim(res, 201, { ok: true, caminho: p, bytes: total });
}

async function apagar(req, res, q) {
  const p = caminhoSeguro(q.get('p'));
  const exp = Number(q.get('exp'));
  if (!p || !Number.isFinite(exp)) return fim(res, 400, { erro: 'Parâmetros inválidos.' });
  if (!confere(`DELETE\n${p}\n${exp}`, q.get('s'))) return fim(res, 403, { erro: 'Assinatura inválida.' });
  if (exp < Date.now() / 1000) return fim(res, 403, { erro: 'Link vencido.' });
  await fs.rm(path.join(RAIZ, p), { force: true });
  return fim(res, 200, { ok: true });
}


// Foto do app e do site (POST /api/upload, multipart, campo "file"). A Vercel só repassa (rewrite em next.config.ts),
// então o corpo não passa pelo limite de 4,5 MB das funções. Quem está logado é conferido no próprio site (/api/auth),
// com o mesmo cabeçalho Authorization ou cookie que veio. A foto é reduzida aqui (1600 px, JPEG) e gravada na Storage Box.
const MAX_FOTO = 40 * 1024 * 1024;
const SITE = 'https://natalemfamilia.com.br';
const BASE_PUBLICA = 'https://arquivos.natalemfamilia.com.br';
const erroApp = (res, codigo, msg) => fim(res, codigo, { error: msg });

async function quemEsta(req) {
  const h = { Accept: 'application/json' };
  if (req.headers.authorization) h.Authorization = req.headers.authorization;
  if (req.headers.cookie) h.Cookie = req.headers.cookie;
  if (!h.Authorization && !h.Cookie) return null;
  const r = await fetch(`${SITE}/api/auth`, { headers: h, signal: AbortSignal.timeout(10_000) }).catch(() => null);
  const j = r && r.ok ? await r.json().catch(() => null) : null;
  const id = j?.user?.id;
  return Number.isInteger(id) && id > 0 ? id : null;
}

function rodar(cmd, args) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: 'ignore' });
    const t = setTimeout(() => p.kill('SIGKILL'), 60_000);
    p.on('close', (c) => { clearTimeout(t); resolve(c === 0); });
    p.on('error', () => { clearTimeout(t); resolve(false); });
  });
}

async function envioApp(req, res) {
  const ct = String(req.headers['content-type'] || '');
  if (!ct.toLowerCase().startsWith('multipart/form-data')) return erroApp(res, 400, 'Nenhuma foto enviada.');
  const declarado = Number(req.headers['content-length']);
  if (Number.isFinite(declarado) && declarado > MAX_FOTO) return erroApp(res, 413, 'A foto passou de 40 MB.');
  const userId = await quemEsta(req);
  if (!userId) { req.resume(); return erroApp(res, 401, 'Entre com seu usuário para continuar.'); }

  const partes = [];
  let total = 0;
  const cabe = await new Promise((resolve) => {
    req.on('data', (c) => { total += c.length; if (total > MAX_FOTO) { resolve(false); req.destroy(); } else partes.push(c); });
    req.on('end', () => resolve(true));
    req.on('error', () => resolve(false));
  });
  if (!cabe) return erroApp(res, 413, 'A foto passou de 40 MB.');

  const form = await new Response(Buffer.concat(partes), { headers: { 'content-type': ct } }).formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string' || !file.size) return erroApp(res, 400, 'Nenhuma foto enviada.');
  const tipo = String(file.type || '').toLowerCase();
  if (tipo && !tipo.startsWith('image/') && tipo !== 'application/octet-stream') return erroApp(res, 400, 'Envie uma foto (JPG, PNG, WEBP ou HEIC).');

  await fs.mkdir(TEMP, { recursive: true });
  const base = path.join(TEMP, `foto-${Date.now()}-${randomBytes(6).toString('hex')}`);
  const entrada = `${base}.orig`, saida = `${base}.jpg`;
  try {
    await fs.writeFile(entrada, Buffer.from(await file.arrayBuffer()));
    const reduziu = await rodar('python3', [path.join(path.dirname(new URL(import.meta.url).pathname), 'reduzir.py'), entrada, saida]);
    let pronto = saida, ext = 'jpg';
    if (!reduziu) {
      // Não deu para ler como imagem: só aceita como está se for um formato que o navegador mostra.
      const extOrig = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[tipo];
      if (!extOrig) return erroApp(res, 400, 'Não consegui abrir essa foto. Tente outra.');
      pronto = entrada; ext = extOrig;
    }
    const caminho = `natal/${userId}/${Date.now()}-${randomBytes(5).toString('hex')}.${ext}`;
    const destino = path.join(RAIZ, caminho);
    await fs.mkdir(path.dirname(destino), { recursive: true });
    const parcial = `${destino}.parcial-${randomBytes(4).toString('hex')}`;
    await fs.copyFile(pronto, parcial);
    await fs.rename(parcial, destino);
    return fim(res, 200, { url: `${BASE_PUBLICA}/f/${caminho}` });
  } catch (e) {
    console.error('envio do app falhou', e?.code || e?.message);
    return erroApp(res, 500, 'Não consegui salvar a foto. Tente de novo.');
  } finally {
    await fs.rm(entrada, { force: true });
    await fs.rm(saida, { force: true });
  }
}

createServer((req, res) => {
  cors(req, res);
  const u = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (u.pathname === '/saude') return fim(res, 200, { ok: true });
  if (req.method === 'POST' && u.pathname === '/app-upload') return envioApp(req, res).catch((e) => { console.error('erro', e?.message); if (!res.headersSent) fim(res, 500, { error: 'Erro interno.' }); });
  const tratar = req.method === 'PUT' && u.pathname === '/envio' ? receber : req.method === 'DELETE' && u.pathname === '/apagar' ? apagar : null;
  if (!tratar) return fim(res, 404, { erro: 'Não encontrado.' });
  tratar(req, res, u.searchParams).catch((e) => { console.error('erro', e?.message); if (!res.headersSent) fim(res, 500, { erro: 'Erro interno.' }); });
}).listen(PORTA, '127.0.0.1', () => console.log(`natal-arquivos em 127.0.0.1:${PORTA}, raiz ${RAIZ}`));
