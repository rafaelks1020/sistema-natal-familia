import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const js = ts.transpileModule(fs.readFileSync(new URL('./batalha.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const { compararBatalha, notasLinhasValidas, MAX_LINHAS_BATALHA } = mod.exports;

test('compara cada trecho e vence quem ganhou mais trechos', () => {
  const r = compararBatalha([0.8, 0.7, 0.9, 0.6], [0.7, 0.8, 0.9, 0.5]);
  assert.equal(r.completa, true);
  assert.deepEqual(r.placar, [2, 1]);
  assert.equal(r.empates, 1);
  assert.equal(r.vencedor, 1);
  assert.deepEqual(r.trechos.map((t) => t.vencedor), [1, 2, null, 1]);
});
test('nota total maior não desempata o placar de trechos', () => {
  const r = compararBatalha([1, 0.8], [0, 0.9]);
  assert.deepEqual(r.placar, [1, 1]);
  assert.equal(r.vencedor, null);
});
test('segunda pessoa vence e trocando os lados o resultado é simétrico', () => {
  const a = compararBatalha([0.1, 0.8, 0.7], [0.3, 0.9, 0.7]);
  const b = compararBatalha([0.3, 0.9, 0.7], [0.1, 0.8, 0.7]);
  assert.equal(a.vencedor, 2);
  assert.equal(b.vencedor, 1);
  assert.deepEqual(a.placar, b.placar.toReversed());
});
test('zeros são notas válidas e empatam; arredonda com a precisão do motor', () => {
  const r = compararBatalha([0, 1, 0.1 + 0.2], [0, 1, 0.3]);
  assert.equal(r.empates, 3);
  assert.equal(r.vencedor, null);
});
test('aguarda pontuações ausentes, sem tratar ausência como zero', () => {
  const vazio = compararBatalha(null, null);
  assert.deepEqual(vazio.trechos, []);
  for (const r of [compararBatalha([0.8, 0], null), compararBatalha(null, [1])]) {
    assert.equal(r.completa, false);
    assert.equal(r.vencedor, null);
    assert.deepEqual(r.placar, [0, 0]);
    assert.equal(r.empates, 0);
    assert.ok(r.trechos.every((t) => t.notas.includes(null)));
  }
});
test('listas de tamanhos diferentes nunca declaram vencedor', () => {
  const r = compararBatalha([1, 1], [0]);
  assert.equal(r.completa, false);
  assert.equal(r.vencedor, null);
  assert.deepEqual(r.trechos[1].notas, [1, null]);
});
test('recusa payload vazio, esparso, grande demais ou notas fora do intervalo', () => {
  for (const invalido of [[], [NaN], [Infinity], [-0.1], [1.1], ['0.8'], [null], {}, new Array(2), new Array(MAX_LINHAS_BATALHA + 1).fill(0)]) {
    assert.equal(notasLinhasValidas(invalido), false);
    assert.throws(() => compararBatalha(invalido, [1]), /inválidas/);
  }
  assert.equal(notasLinhasValidas([0, 0.5, 1]), true);
});
test('preserva os arrays de pontuação recebidos', () => {
  const a = Object.freeze([0.2, 0.8]); const b = Object.freeze([0.1, 0.9]);
  compararBatalha(a, b);
  assert.deepEqual(a, [0.2, 0.8]);
  assert.deepEqual(b, [0.1, 0.9]);
});
