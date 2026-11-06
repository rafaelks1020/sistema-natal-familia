import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Executar: node --test app/telao/roteiro.test.mjs. Sem banco, sem rede, sem navegador.
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'roteiro.ts');
const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const { noiteDoEvento, itemAtivo, proximoItem, ordenarRoteiro, ROTEIRO_PADRAO_NATAL, acaoRoteiroValida, rotuloAcaoRoteiro } = mod.exports;

const padrao = ROTEIRO_PADRAO_NATAL.map((item, i) => ({ id: i + 1, ...item }));

test('antes do primeiro horário da noite não há item ativo e o próximo é 19:00', () => {
  const t = Date.parse('2025-12-24T18:30:00-03:00');
  assert.equal(itemAtivo(padrao, t), null);
  assert.equal(proximoItem(padrao, t)?.hora, '19:00');
  assert.equal(proximoItem(padrao, t)?.acao, 'cena:fotos');
});

test('durante a noite retorna o último horário que já chegou e o próximo a acontecer', () => {
  const as19 = Date.parse('2025-12-24T19:00:00-03:00');
  assert.equal(itemAtivo(padrao, as19)?.acao, 'cena:fotos');
  assert.equal(proximoItem(padrao, as19)?.hora, '20:00');

  const as2115 = Date.parse('2025-12-24T21:15:00-03:00');
  assert.equal(itemAtivo(padrao, as2115)?.hora, '21:00');
  assert.equal(itemAtivo(padrao, as2115)?.acao, 'cena:ceia');
  assert.equal(proximoItem(padrao, as2115)?.hora, '22:30');
});

test('virada da meia-noite: às 23:59 e às 00:02 de 25/12 mantém cena:virada e aponta 00:05 como próximo', () => {
  const antesMeiaNoite = Date.parse('2025-12-24T23:59:30-03:00');
  assert.equal(itemAtivo(padrao, antesMeiaNoite)?.hora, '23:59');
  assert.equal(itemAtivo(padrao, antesMeiaNoite)?.acao, 'cena:virada');
  assert.equal(proximoItem(padrao, antesMeiaNoite)?.hora, '00:05');
  assert.equal(proximoItem(padrao, antesMeiaNoite)?.acao, 'cena:brinde');

  const logoAposMeiaNoite = Date.parse('2025-12-25T00:02:00-03:00');
  assert.equal(itemAtivo(padrao, logoAposMeiaNoite)?.hora, '23:59');
  assert.equal(itemAtivo(padrao, logoAposMeiaNoite)?.acao, 'cena:virada');
  assert.equal(proximoItem(padrao, logoAposMeiaNoite)?.hora, '00:05');
  assert.equal(proximoItem(padrao, logoAposMeiaNoite)?.acao, 'cena:brinde');
});

test('depois da meia-noite avança para 00:05 e 00:15 na mesma noite', () => {
  const as0006 = Date.parse('2025-12-25T00:06:00-03:00');
  assert.equal(itemAtivo(padrao, as0006)?.hora, '00:05');
  assert.equal(itemAtivo(padrao, as0006)?.acao, 'cena:brinde');
  assert.equal(proximoItem(padrao, as0006)?.hora, '00:15');
  assert.equal(proximoItem(padrao, as0006)?.acao, 'ciclo');

  const as0200 = Date.parse('2025-12-25T02:00:00-03:00');
  assert.equal(itemAtivo(padrao, as0200)?.hora, '00:15');
  assert.equal(itemAtivo(padrao, as0200)?.acao, 'ciclo');
  assert.equal(proximoItem(padrao, as0200), null);
});

test('funciona mesmo se a lista vier na ordem de relógio do banco (00:05 antes de 19:00)', () => {
  const embaralhado = [...padrao].reverse();
  const ordenado = ordenarRoteiro(embaralhado);
  assert.equal(ordenado[0].hora, '19:00');
  assert.equal(ordenado[ordenado.length - 1].hora, '00:15');
  const as2330 = Date.parse('2025-12-24T23:30:00-03:00');
  assert.equal(itemAtivo(embaralhado, as2330)?.hora, '23:00');
  assert.equal(proximoItem(embaralhado, as2330)?.hora, '23:59');
});

test('valida ações e gera rótulo legível', () => {
  assert.equal(acaoRoteiroValida('cena:ceia'), true);
  assert.equal(acaoRoteiroValida('musica:ceia'), true);
  assert.equal(acaoRoteiroValida('invalida'), false);
  assert.equal(rotuloAcaoRoteiro('aviso', 'Bem-vindos!'), 'Aviso: "Bem-vindos!"');
  assert.equal(rotuloAcaoRoteiro('cena:brinde'), 'Cena: Hora do brinde');
});

test('noiteDoEvento: só vale no dia da ceia em SP e na madrugada seguinte até 06:00', () => {
  const ceia = '2025-12-24T20:00:00-03:00';
  assert.equal(noiteDoEvento(ceia, Date.parse('2025-12-24T19:00:00-03:00')), true);
  assert.equal(noiteDoEvento(ceia, Date.parse('2025-12-25T00:30:00-03:00')), true);
  assert.equal(noiteDoEvento(ceia, Date.parse('2025-12-25T05:59:00-03:00')), true);
  assert.equal(noiteDoEvento(ceia, Date.parse('2025-12-25T06:00:00-03:00')), false);
  assert.equal(noiteDoEvento(ceia, Date.parse('2025-12-23T21:00:00-03:00')), false);
  assert.equal(noiteDoEvento(ceia, Date.parse('2025-12-26T01:00:00-03:00')), false);
  assert.equal(noiteDoEvento('lixo', Date.parse('2025-12-24T21:00:00-03:00')), false);
});
