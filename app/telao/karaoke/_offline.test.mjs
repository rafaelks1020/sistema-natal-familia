import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Executar: node --test app/telao/karaoke/_offline.test.mjs. Sem banco, sem rede, sem navegador.
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '_offline.ts');
const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const { urlJsonDaMusica, chaveCache, formatarTamanho, musicasDoCatalogo, audioDaMusica, oQueFaltaBaixar } = mod.exports;

test('chave do JSON ignora o domínio e a do áudio fica completa', () => {
  assert.equal(urlJsonDaMusica(8), '/api/karaoke/catalogo/8');
  assert.equal(chaveCache('/api/karaoke/catalogo/8'), '/api/karaoke/catalogo/8');
  assert.equal(chaveCache('https://natalemfamilia.com.br/api/karaoke/catalogo/8?x=1'), '/api/karaoke/catalogo/8?x=1');
  assert.equal(chaveCache('https://arquivos.natalemfamilia.com.br/f/x.mp3#t=1'), 'https://arquivos.natalemfamilia.com.br/f/x.mp3');
});

test('tamanho em MB com vírgula', () => {
  assert.equal(formatarTamanho(0), '0,0 MB');
  assert.equal(formatarTamanho(-4), '0,0 MB');
  assert.equal(formatarTamanho(1.5 * 1024 * 1024), '1,5 MB');
});

test('catálogo e áudio só com o formato esperado', () => {
  assert.deepEqual(musicasDoCatalogo(null), []);
  assert.deepEqual(musicasDoCatalogo({ musicas: [{ id: 1, status: 'pronta' }, { id: '2', status: 'pronta' }, null, { id: 3, status: 1 }] }), [{ id: 1, status: 'pronta' }]);
  assert.equal(audioDaMusica({ audio_url: ' https://arquivos.natalemfamilia.com.br/f/a.mp3 ' }), 'https://arquivos.natalemfamilia.com.br/f/a.mp3');
  assert.equal(audioDaMusica({ audio_url: '' }), null);
  assert.equal(audioDaMusica(null), null);
});

test('decide o que falta: pula pronta já no cache e ignora o resto', () => {
  const musicas = [
    { id: 1, status: 'pronta' },
    { id: 2, status: 'baixando' },
    { id: 3, status: 'pronta' },
    { id: 4, status: 'pronta' },
    { id: 1, status: 'pronta' },
  ];
  const urls = new Set([
    'https://natalemfamilia.com.br/api/karaoke/catalogo/1',
    'https://arquivos.natalemfamilia.com.br/f/a.mp3',
    '/api/karaoke/catalogo/4',
  ]);
  const audio = new Map([
    [1, 'https://arquivos.natalemfamilia.com.br/f/a.mp3'],
    [4, 'https://arquivos.natalemfamilia.com.br/f/b.mp3'],
  ]);
  const r = oQueFaltaBaixar(musicas, urls, audio);
  assert.equal(r.total, 3);
  assert.equal(r.prontas, 1);
  assert.deepEqual(r.falta.map((f) => f.id), [3, 4]);
  assert.deepEqual(r.falta[0], { id: 3, jsonUrl: '/api/karaoke/catalogo/3', audioUrl: null, json: true, audio: true });
  assert.equal(r.falta[1].json, false);
  assert.equal(r.falta[1].audio, true);
  assert.equal(r.falta[1].audioUrl, 'https://arquivos.natalemfamilia.com.br/f/b.mp3');
});

test('JSON em falta e áudio já salvo só pede o JSON', () => {
  const urls = new Set(['https://arquivos.natalemfamilia.com.br/f/c.mp3#t=0']);
  const audio = new Map([[5, 'https://arquivos.natalemfamilia.com.br/f/c.mp3']]);
  const r = oQueFaltaBaixar([{ id: 5, status: 'pronta' }], urls, audio);
  assert.equal(r.prontas, 0);
  assert.equal(r.falta.length, 1);
  assert.equal(r.falta[0].json, true);
  assert.equal(r.falta[0].audio, false);
});
