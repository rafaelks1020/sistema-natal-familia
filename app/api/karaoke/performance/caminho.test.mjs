import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Executar: node --test app/api/karaoke/performance/caminho.test.mjs. Sem navegador.
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'caminho.ts');
const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const { caminhoPerformance, performanceDestaFila, MAX_BYTES_PERFORMANCE, MIN_BYTES_PERFORMANCE } = mod.exports;

test('caminho da apresentação: ano, fila e sufixo, até 400 MB', () => {
  assert.equal(MAX_BYTES_PERFORMANCE, 400 * 1024 * 1024);
  assert.equal(MIN_BYTES_PERFORMANCE, 50_000);
  const p = caminhoPerformance(2026, 15, 'ab12cd34ef');
  assert.equal(p, 'karaoke/performances/2026/15-ab12cd34ef.webm');
  assert.equal(performanceDestaFila(`/${p}`, 2026, 15), true);
  assert.equal(performanceDestaFila(`/${p}`, 2026, 16), false);
  assert.equal(performanceDestaFila(`/${p}`, 2025, 15), false);
  assert.equal(performanceDestaFila(`/karaoke/performances/2026/15-ab12cd34ef.mp4`, 2026, 15), false);
  assert.equal(performanceDestaFila('/karaoke/performances/2026/15-../x.webm', 2026, 15), false);
});

test('caminho rejeita ano, fila ou sufixo fora do contrato', () => {
  assert.throws(() => caminhoPerformance(1999, 1, 'ab12cd34ef'));
  assert.throws(() => caminhoPerformance(2026, 0, 'ab12cd34ef'));
  assert.throws(() => caminhoPerformance(2026, 1, 'ABCDE12345'));
  assert.throws(() => caminhoPerformance(2026, 1, 'curto'));
  assert.throws(() => caminhoPerformance(2026, 1, 'ab12cd34ef/extra'));
});
