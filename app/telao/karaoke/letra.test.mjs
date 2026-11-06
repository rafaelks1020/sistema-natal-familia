import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Executar: node --test app/telao/karaoke/letra.test.mjs. Linha do tempo da letra (funções puras).
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'letra.ts');
const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const { prepararLetra, cenaEm, progressoLinha, progressoPalavra, janelasDaLetra } = mod.exports;

const bruta = [
  { ms: 10000, texto: 'Noite feliz' },
  { ms: 14000, texto: 'Noite de paz' },
  { ms: 17000, texto: '' }, // fim da frase: pausa instrumental
  { ms: 40000, texto: 'Tudo é calma' },
  { ms: 44000, texto: 'Tudo é luz' },
];
const linhas = prepararLetra(bruta);

test('linhas vazias saem e os tempos fecham 250 ms antes da próxima', () => {
  assert.equal(linhas.length, 4);
  assert.equal(linhas[0].ini, 10000);
  assert.equal(linhas[0].fim, 14000 - 250);
  assert.equal(linhas[0].janelaFim, 14000);
  assert.equal(linhas[1].janelaFim, 17000); // a linha vazia marca o fim
  assert.equal(linhas[1].fim, 17000 - 250);
});

test('preenchimento proporcional às letras de cada palavra', () => {
  const l = linhas[0]; // "Noite" (5) + "feliz" (5)
  assert.deepEqual(l.palavras, ['Noite', 'feliz']);
  assert.equal(l.faixas[0].de, 0);
  assert.equal(l.faixas[0].ate, 0.5);
  assert.equal(l.faixas[1].ate, 1);
  assert.equal(progressoLinha(l, 10000), 0);
  assert.equal(progressoLinha(l, l.fim), 1);
  assert.equal(progressoPalavra(l.faixas[0], 0.25), 0.5);
  assert.equal(progressoPalavra(l.faixas[1], 0.25), 0);
  assert.equal(progressoPalavra(l.faixas[1], 1), 1);
});

test('linha muito longe da próxima não é preenchida devagar demais', () => {
  const l = prepararLetra([{ ms: 0, texto: 'Oi' }, { ms: 60000, texto: 'Tchau' }])[0];
  assert.ok(l.fim <= 3500, `fim ${l.fim}`);
});

test('antes da primeira linha é ♪ com pontinhos só nos 3 s finais', () => {
  assert.deepEqual(cenaEm(linhas, 0), { tipo: 'pausa', ant: -1, prox: 0, pontos: 3 });
  assert.equal(cenaEm(linhas, 7500).pontos, 2);
  assert.equal(cenaEm(linhas, 8500).pontos, 1);
  assert.equal(cenaEm(linhas, 9500).pontos, 0);
  assert.equal(cenaEm(linhas, 10000).tipo, 'linha');
});

test('intervalo curto mantém a linha; intervalo longo (> 6 s) vira pausa com contagem', () => {
  assert.equal(cenaEm(linhas, 12000).tipo, 'linha');
  assert.equal(cenaEm(linhas, 16900).tipo, 'linha'); // linha de 14000 termina em 16750
  assert.equal(cenaEm(linhas, 17000).tipo, 'linha'); // ainda segura 1,5 s
  const p = cenaEm(linhas, 20000);
  assert.equal(p.tipo, 'pausa');
  assert.equal(p.ant, 1);
  assert.equal(p.prox, 2);
  assert.equal(p.pontos, 3);
  assert.equal(cenaEm(linhas, 37500).pontos, 2);
  assert.equal(cenaEm(linhas, 38500).pontos, 1);
  assert.equal(cenaEm(linhas, 39500).pontos, 0);
  assert.equal(cenaEm(linhas, 40000).tipo, 'linha');
  assert.equal(cenaEm(linhas, 40000).ant, 2);
});

test('depois da última linha: ♪ sem contagem', () => {
  const c = cenaEm(linhas, 60000);
  assert.deepEqual(c, { tipo: 'pausa', ant: 3, prox: 4, pontos: 0 });
});

test('entradas quebradas não derrubam', () => {
  assert.deepEqual(prepararLetra(null), []);
  assert.deepEqual(prepararLetra([{ ms: NaN, texto: 'x' }, { ms: 5, texto: 3 }]), []);
  assert.deepEqual(cenaEm([], 1000), { tipo: 'pausa', ant: -1, prox: 0, pontos: 0 });
});

test('janelas da nota acompanham o ajuste de tempo', () => {
  const j = janelasDaLetra(linhas, 500);
  assert.deepEqual(j[0], { de: 10500, ate: 14500 });
  assert.equal(j.length, 4);
});
