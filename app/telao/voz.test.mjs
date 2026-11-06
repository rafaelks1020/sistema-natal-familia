import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Executar: node --test app/telao/voz.test.mjs. Sem banco, sem rede, sem navegador.
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'voz.ts');
const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const { interpretarVoz, normalizar, falarDuracao, falarLista } = mod.exports;

test('normaliza acento, pontuação e caixa', () => {
  assert.equal(normalizar('  Natal, PRÓXIMA!  '), 'natal proxima');
  assert.equal(normalizar('Quem está aqui?'), 'quem esta aqui');
});

test('sem a palavra Natal, nada acontece', () => {
  assert.equal(interpretarVoz('próxima'), null);
  assert.equal(interpretarVoz('mostra as fotos'), null);
  assert.equal(interpretarVoz(''), null);
});

test('só a palavra de ativação ou frase solta não vira ação', () => {
  assert.equal(interpretarVoz('Natal'), null);
  assert.equal(interpretarVoz('feliz Natal pra vocês'), null);
  assert.equal(interpretarVoz('Natal, bolo de cenoura'), null);
});

test('navegação', () => {
  assert.deepEqual(interpretarVoz('Natal, próxima'), { tipo: 'proxima' });
  assert.deepEqual(interpretarVoz('natal passa'), { tipo: 'proxima' });
  assert.deepEqual(interpretarVoz('Natal, volta'), { tipo: 'volta' });
  assert.deepEqual(interpretarVoz('Natal, anterior'), { tipo: 'volta' });
  assert.deepEqual(interpretarVoz('Natal, pausa'), { tipo: 'pausa' });
  assert.deepEqual(interpretarVoz('Natal, pare'), { tipo: 'pausa' });
  assert.deepEqual(interpretarVoz('Natal, continua'), { tipo: 'continua' });
  assert.deepEqual(interpretarVoz('Natal, volta ao automático'), { tipo: 'ciclo' });
});

test('cenas', () => {
  assert.deepEqual(interpretarVoz('Natal, mostra as fotos'), { tipo: 'cena', cena: 'fotos' });
  assert.deepEqual(interpretarVoz('Natal, mostra a música'), { tipo: 'cena', cena: 'tocando' });
  assert.deepEqual(interpretarVoz('Natal, quanto falta'), { tipo: 'cena', cena: 'contagem' });
  assert.deepEqual(interpretarVoz('Natal, mostra os recados'), { tipo: 'cena', cena: 'recados' });
  assert.deepEqual(interpretarVoz('Natal, mostra o advento'), { tipo: 'cena', cena: 'advento' });
  assert.deepEqual(interpretarVoz('Natal fotos'), { tipo: 'cena', cena: 'fotos' });
});

test('"volta para as fotos" é cena, "volta" sozinho é voltar', () => {
  assert.deepEqual(interpretarVoz('Natal, volta para as fotos'), { tipo: 'cena', cena: 'fotos' });
  assert.deepEqual(interpretarVoz('Natal, volta'), { tipo: 'volta' });
});

test('placar e presentes', () => {
  assert.deepEqual(interpretarVoz('Natal, mostra o placar'), { tipo: 'placar' });
  assert.deepEqual(interpretarVoz('Natal, quem está aqui'), { tipo: 'presentes' });
  assert.deepEqual(interpretarVoz('Natal, quem ta aqui?'), { tipo: 'presentes' });
  assert.deepEqual(interpretarVoz('Natal, ajuda'), { tipo: 'ajuda' });
});

test('ouve o comando mesmo com fala antes da palavra de ativação', () => {
  assert.deepEqual(interpretarVoz('ei Natal próxima por favor'), { tipo: 'proxima' });
});

test('duração falada', () => {
  assert.equal(falarDuracao(3 * 86400000 + 4 * 3600000 + 5 * 60000), '3 dias e 4 horas');
  assert.equal(falarDuracao(4 * 3600000 + 5 * 60000), '4 horas e 5 minutos');
  assert.equal(falarDuracao(60000), '1 minuto');
  assert.equal(falarDuracao(45000), '45 segundos');
  assert.equal(falarDuracao(1000), '1 segundo');
  assert.equal(falarDuracao(0), '0 segundos');
  assert.equal(falarDuracao(-5), '0 segundos');
});

test('lista falada', () => {
  assert.equal(falarLista([]), '');
  assert.equal(falarLista(['Ana']), 'Ana');
  assert.equal(falarLista(['Ana', 'Bia']), 'Ana e Bia');
  assert.equal(falarLista(['Ana', 'Bia', 'Caio']), 'Ana, Bia e Caio');
});
