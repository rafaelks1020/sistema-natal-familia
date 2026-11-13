import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Executar: node --test app/api/spotify/link.test.mjs. Sem banco, sem rede.
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'link.ts');
const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const { parseSpotifyLink, parsePedido, normalizarTexto } = mod.exports;
const ID = '37i9dQZF1DXcBWIGoYBM5M';

test('aceita o link de convite com si e pt', () => {
  const r = parseSpotifyLink(`https://open.spotify.com/playlist/${ID}?si=abc123&pt=tok-en`);
  assert.equal(r.id, ID);
  assert.equal(r.link, `https://open.spotify.com/playlist/${ID}?si=abc123&pt=tok-en`);
});

test('aceita link sem esquema, com barra final e prefixo intl', () => {
  assert.equal(parseSpotifyLink(`  open.spotify.com/playlist/${ID}/ `).id, ID);
  assert.equal(parseSpotifyLink(`https://open.spotify.com/intl-pt/playlist/${ID}`).id, ID);
});

test('rejeita host, caminho, esquema e credenciais inválidos', () => {
  for (const bad of [
    `https://evil.com/playlist/${ID}`, `https://open.spotify.com.evil.com/playlist/${ID}`,
    `https://open.spotify.com/track/${ID}`, 'https://open.spotify.com/playlist/', 'https://open.spotify.com/playlist/curto',
    `http://open.spotify.com/playlist/${ID}`, `https://user:senha@open.spotify.com/playlist/${ID}`,
    `https://open.spotify.com:8443/playlist/${ID}`, `https://open.spotify.com/playlist/${ID}/extra`,
    'javascript:alert(1)', '', '   ', null, undefined, 42,
  ]) assert.equal(parseSpotifyLink(bad), null, String(bad));
});

test('separa música e artista por " - " ou " por "', () => {
  assert.deepEqual(parsePedido('Então é Natal - Simone'), { nome: 'Então é Natal', artista: 'Simone', chave: 'pedido:entao e natal - simone' });
  assert.deepEqual(parsePedido('Noite Feliz POR  Roberto   Carlos'), { nome: 'Noite Feliz', artista: 'Roberto Carlos', chave: 'pedido:noite feliz por roberto carlos' });
  assert.equal(parsePedido('Jingle Bells - Frank Sinatra - Live').artista, 'Frank Sinatra - Live');
  assert.equal(parsePedido(`Jingle Bells ${String.fromCharCode(0x2013)} Frank Sinatra`).artista, 'Frank Sinatra');
});

test('sem separador o artista fica vazio', () => {
  assert.deepEqual(parsePedido('  Jingle   Bells '), { nome: 'Jingle Bells', artista: '', chave: 'pedido:jingle bells' });
  assert.equal(parsePedido('Hino-do-Natal').artista, '');
  assert.equal(parsePedido('Porto Seguro').artista, '');
  assert.equal(parsePedido('- Simone').artista, '');
});

test('mesma música com acento e caixa diferentes gera a mesma chave', () => {
  assert.equal(parsePedido('Então é NATAL - Simone').chave, parsePedido('entao e natal - simone').chave);
  assert.equal(normalizarTexto('  Ação  Çá '), 'acao ca');
});

test('rejeita pedido vazio ou grande demais', () => {
  assert.equal(parsePedido('   '), null);
  assert.equal(parsePedido('a'.repeat(121)), null);
  assert.equal(parsePedido(null), null);
});

function compilar(nome, dependencias) {
  const caminho = path.join(path.dirname(fileURLToPath(import.meta.url)), nome);
  const js = ts.transpileModule(fs.readFileSync(caminho, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const m = { exports: {} };
  new Function('require', 'module', 'exports', js)((id) => {
    if (!(id in dependencias)) throw new Error(`Dependência não simulada: ${id}`);
    return dependencias[id];
  }, m, m.exports);
  return m.exports;
}

const A = 'spotify:track:aaaaaaaaaaaaaaaaaaaaaa';
const B = 'spotify:track:bbbbbbbbbbbbbbbbbbbbbb';
const C = 'spotify:track:cccccccccccccccccccccc';

test('containsTrack para na página da música e a reordenação só apaga a pendência no fim', async () => {
  const db = {
    query: async () => ({ rows: [], rowCount: 0 }),
    transaction(fn) { return fn((sql, params) => db.query(sql, params)); },
  };
  const { containsTrack, reordenar } = compilar('_service.ts', {
    'server-only': {},
    '@/app/lib/api': { HttpError: class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } } },
    '@/app/lib/db': db,
    '@/app/lib/edicao': { edicaoAtual: () => 2026, hojeSP: () => '2026-11-12' },
    '@/app/lib/session': {},
    './link': mod.exports,
    './momentos': compilar('momentos.ts', {}),
  });
  const fetchOriginal = globalThis.fetch;
  const agoraOriginal = Date.now;
  const envId = process.env.SPOTIFY_CLIENT_ID;
  const envSegredo = process.env.SPOTIFY_CLIENT_SECRET;
  process.env.SPOTIFY_CLIENT_ID = 'id';
  process.env.SPOTIFY_CLIENT_SECRET = 'segredo';
  try {
    let paginas = 0;
    globalThis.fetch = async (url) => {
      paginas++;
      const offset = Number(new URL(url).searchParams.get('offset'));
      const uri = offset === 0 ? A : B;
      return { ok: true, status: 200, json: async () => ({ items: [{ item: { uri } }], next: offset === 0 ? 'proxima' : null }) };
    };
    assert.equal(await containsTrack('pl123', A, 'tok'), true);
    assert.equal(paginas, 1);
    paginas = 0;
    assert.equal(await containsTrack('pl123', B, 'tok'), true);
    assert.equal(paginas, 2);
    paginas = 0;
    assert.equal(await containsTrack('pl123', C, 'tok'), false);
    assert.equal(paginas, 2);

    const linha = [];
    let relogio = 1_700_000_000_000;
    Date.now = () => relogio;
    db.query = async (sql, params = []) => {
      if (sql.includes('SELECT key, value FROM app_settings')) {
        return { rows: [
          { key: 'spotify_refresh_token', value: 'r' },
          { key: 'spotify_access_token', value: 'tok' },
          { key: 'spotify_access_expires', value: '1700003600000' },
          { key: 'spotify_playlist_2026_festa', value: 'pl123' },
        ] };
      }
      if (sql.includes('RETURNING key')) return { rowCount: 1, rows: [{ key: 'vaga' }] };
      if (sql.includes('jsonb_each_text')) { linha.push('pendente'); return { rowCount: 1, rows: [] }; }
      if (sql.includes('FROM playlist_tracks')) return { rows: [{ track_uri: A }, { track_uri: B }, { track_uri: C }] };
      if (sql.includes('DELETE FROM app_settings')) { linha.push('limpa'); return { rowCount: 1, rows: [] }; }
      return { rows: [], rowCount: 0 };
    };
    globalThis.fetch = async (url, init = {}) => {
      const metodo = init.method || 'GET';
      linha.push(metodo);
      if (metodo === 'PUT') relogio += 21_000;
      if (String(url).includes('/items?')) {
        return { ok: true, status: 200, json: async () => ({ items: [{ item: { uri: C } }, { item: { uri: B } }, { item: { uri: A } }], next: null }) };
      }
      if (metodo === 'PUT') return { ok: true, status: 200, json: async () => ({}) };
      throw new Error(`fetch inesperado ${url}`);
    };
    assert.equal(await reordenar('festa', 2026), false);
    assert.deepEqual(linha, ['pendente', 'GET', 'PUT']);

    linha.length = 0;
    relogio = 1_700_000_000_000;
    globalThis.fetch = async (url, init = {}) => {
      const metodo = init.method || 'GET';
      linha.push(metodo);
      if (String(url).includes('/items?')) {
        return { ok: true, status: 200, json: async () => ({ items: [{ item: { uri: C } }, { item: { uri: B } }, { item: { uri: A } }], next: null }) };
      }
      if (metodo === 'PUT') return { ok: true, status: 200, json: async () => ({}) };
      throw new Error(`fetch inesperado ${url}`);
    };
    assert.equal(await reordenar('festa', 2026), true);
    assert.deepEqual(linha, ['pendente', 'GET', 'PUT', 'PUT', 'limpa']);

    linha.length = 0;
    globalThis.fetch = async (url, init = {}) => {
      const metodo = init.method || 'GET';
      linha.push(metodo);
      if (String(url).includes('/items?')) {
        return { ok: true, status: 200, json: async () => ({ items: [{ item: { uri: C } }, { item: { uri: B } }, { item: { uri: A } }], next: null }) };
      }
      throw new Error('spotify caiu');
    };
    assert.equal(await reordenar('festa', 2026), false);
    assert.deepEqual(linha, ['pendente', 'GET', 'PUT']);
  } finally {
    globalThis.fetch = fetchOriginal;
    Date.now = agoraOriginal;
    if (envId === undefined) delete process.env.SPOTIFY_CLIENT_ID; else process.env.SPOTIFY_CLIENT_ID = envId;
    if (envSegredo === undefined) delete process.env.SPOTIFY_CLIENT_SECRET; else process.env.SPOTIFY_CLIENT_SECRET = envSegredo;
  }
});
