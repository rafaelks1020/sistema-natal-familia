import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Executar: node --test app/telao/karaoke/momentos.test.mjs. Sem navegador.
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'momentos.ts');
const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const { PlanejadorMomentos, escolherSegmento, linhaEstudioEm, linhaLetraEm, quebrarPalavras, PASSO_SEGMENTO_MS, VIDA_SEGMENTO_MS, PRE_ROLL_MS, POS_ROLL_MS, MAX_CLIPES, MAX_FOTOS } = mod.exports;

test('planejador: no máximo 3 clipes por música, 1 a cada 20 s, e 6 fotos', () => {
  const p = new PlanejadorMomentos();
  assert.equal(p.pedirClipe(0), true);
  assert.equal(p.pedirClipe(19_999), false, 'menos de 20 s');
  assert.equal(p.pedirClipe(20_000), true);
  assert.equal(p.pedirClipe(45_000), true);
  assert.equal(p.pedirClipe(90_000), false, 'já são 3');
  assert.equal(p.totalClipes, MAX_CLIPES);
  for (let i = 0; i < MAX_FOTOS; i++) assert.equal(p.pedirFoto(), true);
  assert.equal(p.pedirFoto(), false);
  p.reiniciar();
  assert.equal(p.pedirClipe(0), true);
  assert.equal(p.pedirFoto(), true);
});

test('planejador: devolver um clipe não gravado libera a cota e o intervalo', () => {
  const p = new PlanejadorMomentos();
  p.pedirClipe(1000);
  p.devolverClipe();
  assert.equal(p.totalClipes, 0);
  assert.equal(p.pedirClipe(1500), true);
});

/** Simula os dois gravadores alternados: a cada PASSO abre um e fecha o (n-2). Devolve os gravadores vivos em t. */
function vivosEm(t, inicio0 = 0) {
  const lista = [];
  for (let n = 0; inicio0 + n * PASSO_SEGMENTO_MS <= t; n++) {
    const ini = inicio0 + n * PASSO_SEGMENTO_MS;
    if (t < ini + VIDA_SEGMENTO_MS) lista.push({ inicio: ini, vida: VIDA_SEGMENTO_MS });
  }
  return lista;
}

test('segmentos: nunca há mais de 2 gravadores vivos e o gravador escolhido cobre 4 s antes e 4 s depois do gatilho', () => {
  for (let t = 0; t <= 120_000; t += 250) assert.ok(vivosEm(t).length <= 2, `t=${t}`);
  for (let t = 4000; t <= 120_000; t += 137) {
    const vivos = vivosEm(t);
    const i = escolherSegmento(vivos, t);
    assert.ok(i >= 0, `t=${t}`);
    const s = vivos[i];
    const pre = t - s.inicio;
    assert.ok(pre >= PRE_ROLL_MS, `pré-roll ${pre} em t=${t}`);
    assert.ok(pre < PASSO_SEGMENTO_MS + PRE_ROLL_MS, `pré-roll ${pre} em t=${t} passa de 12 s`);
    assert.ok(s.inicio + s.vida >= t + POS_ROLL_MS, `não cobre os 4 s depois em t=${t}`);
  }
});

test('segmentos: gatilho nos primeiros 4 s usa o gravador mais antigo (pré-roll menor)', () => {
  const vivos = vivosEm(2500);
  assert.equal(vivos.length, 1);
  assert.equal(escolherSegmento(vivos, 2500), 0);
  assert.equal(escolherSegmento([], 1000), -1);
  // gravador que acaba antes de t + 4 s: o fallback pega o que dura mais
  const i = escolherSegmento([{ inicio: 0, vida: 5000 }, { inicio: 2000, vida: 5500 }], 4000);
  assert.equal(i, 1);
});

test('letra do estúdio: linha atual, palavras cantadas e intervalo sem linha', () => {
  const linhas = [
    { inicio_ms: 5000, fim_ms: 8000, palavras: [{ texto: 'Então', inicio_ms: 5000, fim_ms: 5800 }, { texto: 'é', inicio_ms: 5900, fim_ms: 6200 }, { texto: 'Natal', inicio_ms: 6300, fim_ms: 8000 }] },
    { inicio_ms: 20000, fim_ms: 22000, palavras: [{ texto: 'Depois', inicio_ms: 20000, fim_ms: 22000 }] },
  ];
  assert.equal(linhaEstudioEm(linhas, 1000), null, 'antes da primeira');
  assert.deepEqual(linhaEstudioEm(linhas, 4000), { palavras: ['Então', 'é', 'Natal'], cantadas: 0 }, 'a linha aparece 1,2 s antes');
  assert.equal(linhaEstudioEm(linhas, 6000).cantadas, 2);
  assert.equal(linhaEstudioEm(linhas, 8000).cantadas, 3);
  assert.equal(linhaEstudioEm(linhas, 12000), null, 'intervalo longo');
  assert.deepEqual(linhaEstudioEm(linhas, 19000).palavras, ['Depois']);
});

test('letra sincronizada: preenchimento por faixas de cada palavra', () => {
  const linhas = [{ palavras: ['a', 'b', 'c'], faixas: [{ de: 0, ate: 0.3 }, { de: 0.35, ate: 0.6 }, { de: 0.65, ate: 1 }], ini: 1000, fim: 4000 }];
  assert.equal(linhaLetraEm(linhas, -500), null);
  assert.equal(linhaLetraEm(linhas, 100).cantadas, 0, 'a linha aparece 1,2 s antes');
  assert.equal(linhaLetraEm(linhas, 500).cantadas, 0);
  assert.equal(linhaLetraEm(linhas, 1000).cantadas, 1);
  assert.equal(linhaLetraEm(linhas, 2200).cantadas, 2);
  assert.equal(linhaLetraEm(linhas, 3500).cantadas, 3);
  assert.equal(linhaLetraEm(linhas, 9000), null);
});

test('quebrar palavras: respeita a largura e não deixa linha vazia', () => {
  const medir = (t) => t.length * 10;
  assert.deepEqual(quebrarPalavras(['aaa', 'bbb', 'ccc', 'ddd'], medir, 75), [[0, 2], [2, 4]]);
  assert.deepEqual(quebrarPalavras(['aaaaaaaaaa'], medir, 20), [[0, 1]]);
  assert.deepEqual(quebrarPalavras([], medir, 100), []);
});
