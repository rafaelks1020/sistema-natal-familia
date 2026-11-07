import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Executar: node --test app/telao/karaoke/atraso.test.mjs
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'atraso.ts');
const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const { gerarPulso, acharPulso, medianaDeAtrasos, medicoesConsistentes, avaliarAtraso, latenciaDaPontuacao, ATRASO_AVISO_MS, ATRASO_ALTO_MS } = mod.exports;

function prng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function captura({ sr, atrasoMs, ganho = 0.3, ruido = 0.01, seed = 1, duracao = 0.7, inverter = false, eco = 0 }) {
  const rnd = prng(seed);
  const x = Float32Array.from({ length: Math.round(sr * duracao) }, () => (rnd() * 2 - 1) * ruido);
  const p = gerarPulso(sr);
  const ini = atrasoMs / 1000 * sr;
  const pos = (ini0, g) => { const base = Math.floor(ini0); const frac = ini0 - base; for (let i = 0; i < p.length; i++) { const v = g * (inverter ? -1 : 1) * p[i]; if (base + i < x.length) x[base + i] += v * (1 - frac); if (base + i + 1 < x.length) x[base + i + 1] += v * frac; } };
  pos(ini, ganho);
  if (eco) pos(ini + 0.012 * sr, ganho * eco);
  return x;
}

test('pulso: 3 ms, normalizado, sem DC grande', () => {
  const p = gerarPulso(48000);
  assert.equal(p.length, 144);
  assert.ok(Math.max(...p.map(Math.abs)) <= 1);
});

test('acha o pulso na posição certa (±0,5 amostra) em 48 kHz e 44,1 kHz', () => {
  for (const sr of [48000, 44100]) {
    for (const atraso of [12.4, 45.7, 83.3, 140, 250.9]) {
      const a = acharPulso(captura({ sr, atrasoMs: atraso, seed: Math.round(atraso) }), gerarPulso(sr));
      assert.ok(a, `sem pico em ${atraso} ms`);
      assert.ok(Math.abs(a.indice / sr * 1000 - atraso) < 0.5 / sr * 1000 + 0.05, `${a.indice / sr * 1000} x ${atraso}`);
    }
  }
});

test('funciona com polaridade invertida, sinal fraco e eco curto depois', () => {
  const sr = 48000;
  const a = acharPulso(captura({ sr, atrasoMs: 90, ganho: 0.05, inverter: true, eco: 0.5, seed: 3 }), gerarPulso(sr));
  assert.ok(a);
  assert.ok(Math.abs(a.indice / sr * 1000 - 90) < 0.1);
});

test('sem pulso (só ruído ou silêncio): devolve null', () => {
  const sr = 48000;
  assert.equal(acharPulso(captura({ sr, atrasoMs: 50, ganho: 0, seed: 5 }), gerarPulso(sr)), null);
  assert.equal(acharPulso(new Float32Array(sr), gerarPulso(sr)), null);
  assert.equal(acharPulso(new Float32Array(10), gerarPulso(sr)), null);
});

test('mediana de 3 medições ignora uma fora da curva', () => {
  assert.equal(medianaDeAtrasos([80, 82, 400]), 82);
  assert.equal(medianaDeAtrasos([50]), 50);
  assert.equal(medianaDeAtrasos([10, 20]), 15);
  assert.equal(medianaDeAtrasos([]), null);
});

test('avaliação: até 60 ms bom; acima avisa com dicas; acima de 120 sugere desligar', () => {
  assert.equal(avaliarAtraso(ATRASO_AVISO_MS).nivel, 'bom');
  const aviso = avaliarAtraso(ATRASO_AVISO_MS + 1);
  assert.equal(aviso.nivel, 'aviso');
  assert.match(aviso.texto, /Modo Jogo da TV/);
  assert.match(aviso.texto, /cabo em vez de Bluetooth/);
  assert.match(aviso.texto, /direct monitor/);
  const alto = avaliarAtraso(ATRASO_ALTO_MS + 1);
  assert.equal(alto.nivel, 'alto');
  assert.match(alto.texto, /Desligue a Voz na TV/);
});

test('atraso da pontuação: medido mais a margem, em passos de 10 ms, entre 0 e 400', () => {
  assert.equal(latenciaDaPontuacao(83), 120);
  assert.equal(latenciaDaPontuacao(0), 40);
  assert.equal(latenciaDaPontuacao(900), 400);
  assert.equal(latenciaDaPontuacao(-100), 0);
});

test('consistência: duas de três a 20 ms da mediana; espalhadas não valem', () => {
  assert.equal(medicoesConsistentes([109, 128, 123]), true);
  assert.equal(medicoesConsistentes([80, 82, 400]), true);
  assert.equal(medicoesConsistentes([100, 145, 179]), false);
  assert.equal(medicoesConsistentes([132, 162, 191]), false);
  assert.equal(medicoesConsistentes([]), false);
});
