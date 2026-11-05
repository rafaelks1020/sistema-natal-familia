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
