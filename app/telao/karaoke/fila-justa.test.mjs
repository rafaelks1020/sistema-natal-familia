import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const js = ts.transpileModule(fs.readFileSync(new URL('./fila-justa.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const { ordenarFilaJusta } = mod.exports;
const item = (id, user_id, extras = {}) => ({ id, user_id, status: 'fila', ...extras });
const ids = (fila) => ordenarFilaJusta(fila).map((i) => i.id);

test('menos participações primeiro, inclusive apresentações sem nota', () => {
  assert.deepEqual(ids([item(1, 1, { status: 'feita' }), item(2, 1), item(3, 2)]), [3, 2]);
});
test('mesma rodada usa chegada original, sem depender da ordem da consulta ou posição', () => {
  assert.deepEqual(ids([item('12', 2, { posicao: 1 }), item('10', 1, { posicao: 9 })]), ['10', '12']);
});
test('projeta as rodadas dos pedidos pendentes para alternar cantores', () => {
  assert.deepEqual(ids([item(1, 1), item(2, 1), item(3, 2), item(4, 2), item(5, 3)]), [1, 3, 5, 2, 4]);
});
test('conta apresentação em andamento e ignora as puladas', () => {
  assert.deepEqual(ids([item(1, 1, { status: 'cantando' }), item(2, 2, { status: 'pulada' }), item(3, 1), item(4, 2)]), [4, 3]);
});
test('dueto conta para ambos e usa a maior contagem, sem permitir furar a fila', () => {
  assert.deepEqual(ids([item(1, 1, { status: 'feita', dueto_user_id: 2 }), item(2, 2), item(3, 3)]), [3, 2]);
  assert.deepEqual(ids([item(1, 2, { status: 'feita' }), item(2, 1, { dueto_user_id: 2 }), item(3, 3)]), [3, 2]);
  assert.deepEqual(ids([item(1, 1, { dueto_user_id: 2 }), item(2, 2), item(3, 3)]), [1, 3, 2]);
});
test('ordem manual prevalece sobre rodadas e novos pedidos', () => {
  assert.deepEqual(ids([item(1, 1, { status: 'feita' }), item(2, 1, { prioridade_manual: 1 }), item(3, 2), item(4, 3, { prioridade_manual: 2 })]), [2, 4, 3]);
});
test('batalha permanece consecutiva e mantém a ordem das duas apresentações', () => {
  const b = { batalha_id: 'a' };
  assert.deepEqual(ids([item(1, 1, { ...b, batalha_rodada: 1 }), item(2, 3), item(3, 2, { ...b, batalha_rodada: 2 })]), [1, 3, 2]);
});
test('batalha usa a maior contagem dos adversários para não beneficiar quem já cantou', () => {
  assert.deepEqual(ids([item(1, 2, { status: 'feita' }), item(2, 1, { batalha_id: 'a', batalha_rodada: 1 }), item(3, 3), item(4, 2, { batalha_id: 'a', batalha_rodada: 2 })]), [3, 2, 4]);
});
test('segunda apresentação de batalha iniciada vem antes até de prioridade manual', () => {
  for (const status of ['cantando', 'feita']) {
    assert.deepEqual(ids([item(1, 1, { status, batalha_id: 'a', batalha_rodada: 1 }), item(2, 3, { prioridade_manual: 1 }), item(3, 2, { batalha_id: 'a', batalha_rodada: 2 })]), [3, 2]);
  }
});
test('não modifica o histórico congelado e aceita fila vazia', () => {
  const fila = Object.freeze([Object.freeze(item(2, 1)), Object.freeze(item(1, 2))]);
  assert.deepEqual(ids(fila), [1, 2]);
  assert.deepEqual(fila.map((i) => i.id), [2, 1]);
  assert.deepEqual(ids([]), []);
});
