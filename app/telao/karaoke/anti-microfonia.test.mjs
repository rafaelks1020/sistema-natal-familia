import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Executar: node --test app/telao/karaoke/anti-microfonia.test.mjs. Sem navegador: o espectro vem de uma FFT feita aqui.
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'anti-microfonia.ts');
const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const { DetectorMicrofonia, GerenciadorMicrofonia, acharPicos, MAX_CORTES, PROFUNDIDADES_DB } = mod.exports;

const SR = 48000;
const N = 4096;
const BIN_HZ = SR / N;
const HOP = Math.round(SR * 0.033);

// PRNG determinístico e ruído gaussiano.
function prng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function gauss(rnd) { return Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd()); }

const janela = Float64Array.from({ length: N }, (_, i) => 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (N - 1)));
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang); const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1; let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k; const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci; const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}
/** Espectro em dB (frequencyBinCount = N/2), como o AnalyserNode (janela de Blackman, magnitude / N). */
function espectroDb(sinal, ini) {
  const re = new Float64Array(N); const im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = (sinal[ini + i] ?? 0) * janela[i];
  fft(re, im);
  const out = new Float32Array(N / 2);
  for (let k = 0; k < N / 2; k++) out[k] = 20 * Math.log10(Math.hypot(re[k], im[k]) / N + 1e-12);
  return out;
}

/** Roda o detector a cada 33 ms sobre o sinal e devolve as detecções com o instante. */
function rodar(sinal, opcoes = {}) {
  const det = new DetectorMicrofonia({ sampleRate: SR, fftSize: N, ...opcoes });
  const achados = [];
  for (let ini = 0; ini + N <= sinal.length; ini += HOP) {
    const t = ((ini + N) / SR) * 1000;
    const d = det.analisar(espectroDb(sinal, ini), t);
    if (d) achados.push({ t, ...d });
  }
  return achados;
}

function ruido(segundos, std, seed) {
  const rnd = prng(seed);
  return Float32Array.from({ length: Math.round(SR * segundos) }, () => gauss(rnd) * std);
}

test('senoide crescente em 2,5 kHz sobre ruído: detecta e devolve a frequência certa (±1 bin)', () => {
  const s = ruido(2, 0.002, 1);
  for (let i = 0; i < s.length; i++) {
    const a = 0.002 * Math.pow(150, i / s.length); // 0,002 até 0,3
    s[i] += a * Math.sin((2 * Math.PI * 2500 * i) / SR);
  }
  const d = rodar(s);
  assert.ok(d.length > 0, 'não detectou');
  for (const x of d) assert.ok(Math.abs(x.hz - 2500) <= BIN_HZ, `hz ${x.hz}`);
  assert.ok(d[0].t < 1500, `demorou ${d[0].t} ms`);
  assert.ok(d[0].excessoDb >= 18);
});

test('senoide constante também é detectada, depois de persistir 250 ms', () => {
  const s = ruido(1.5, 0.002, 2);
  for (let i = 0; i < s.length; i++) s[i] += 0.05 * Math.sin((2 * Math.PI * 1234 * i) / SR);
  const d = rodar(s);
  assert.ok(d.length > 0);
  assert.ok(d[0].duracaoMs >= 250 || d[0].cresceu);
  assert.ok(Math.abs(d[0].hz - 1234) <= BIN_HZ);
});

function voz({ f0, vibratoSt, segundos, seed, amp = 0.2 }) {
  const rnd = prng(seed);
  const fases = Array.from({ length: 30 }, () => rnd() * 2 * Math.PI);
  const s = ruido(segundos, 0.002, seed + 7);
  let fase = 0;
  for (let i = 0; i < s.length; i++) {
    const t = i / SR;
    const f = f0 * Math.pow(2, (vibratoSt * Math.sin(2 * Math.PI * 5.5 * t)) / 12);
    fase += (2 * Math.PI * f) / SR;
    let v = 0;
    for (let h = 1; h <= 25 && f * h < SR / 2.2; h++) v += (1 / h) * (1 + 0.5 * Math.sin(2 * Math.PI * (0.7 + 0.13 * h) * t + fases[h])) * Math.sin(h * fase + fases[h]);
    s[i] += amp * v;
  }
  return s;
}

test('voz cantada com vibrato e harmônicos variando: não detecta', () => {
  for (const f0 of [196, 220, 330, 440]) assert.deepEqual(rodar(voz({ f0, vibratoSt: 0.4, segundos: 3, seed: f0 })), [], `f0 ${f0}`);
});

test('voz sustentada sem vibrato (harmônicos estáveis): não detecta, pela família harmônica', () => {
  for (const f0 of [220, 440]) assert.deepEqual(rodar(voz({ f0, vibratoSt: 0, segundos: 2, seed: f0 + 3 })), [], `f0 ${f0}`);
});

test('glissando de senoide (frequência andando): não detecta', () => {
  const s = ruido(1.5, 0.002, 5);
  let fase = 0;
  for (let i = 0; i < s.length; i++) {
    const f = 1000 + 2000 * (i / s.length);
    fase += (2 * Math.PI * f) / SR;
    s[i] += 0.1 * Math.sin(fase);
  }
  assert.deepEqual(rodar(s), []);
});

test('silêncio e ruído de fundo: não detecta nada', () => {
  assert.deepEqual(rodar(new Float32Array(SR * 2)), []);
  assert.deepEqual(rodar(ruido(2, 0.003, 9)), []);
});

test('acharPicos: 17 dB de excesso não passa, 25 dB passa', () => {
  const esp = new Float32Array(N / 2).fill(-90);
  const k = Math.round(2500 / BIN_HZ);
  esp[k] = -90 + 17; esp[k - 1] = -90 + 5; esp[k + 1] = -90 + 5;
  assert.equal(acharPicos(esp, { sampleRate: SR, fftSize: N, nivelMinDb: -100 }).length, 0);
  esp[k] = -90 + 25;
  const p = acharPicos(esp, { sampleRate: SR, fftSize: N, nivelMinDb: -100 });
  assert.equal(p.length, 1);
  assert.equal(p[0].bin, k);
});

test('gerenciador: abre cortes, aprofunda na mesma frequência e reaproveita o mais antigo depois de 8', () => {
  const g = new GerenciadorMicrofonia();
  let t = 0;
  const a1 = g.aoDetectar({ hz: 1000 }, t);
  assert.equal(a1[0].tipo, 'cortar');
  assert.equal(a1[0].ganhoDb, PROFUNDIDADES_DB[0]);
  assert.equal(a1[0].q, 30);
  const a2 = g.aoDetectar({ hz: 1005 }, (t += 400));
  assert.equal(a2[0].ganhoDb, PROFUNDIDADES_DB[1]);
  assert.equal(g.estado().cortes.length, 1);
  for (let i = 1; i < MAX_CORTES; i++) g.aoDetectar({ hz: 1000 + i * 500 }, (t += 400));
  assert.equal(g.estado().cortes.length, MAX_CORTES);
  const nova = g.aoDetectar({ hz: 9000 }, (t += 400));
  assert.equal(nova[0].indice, 0, 'reaproveita o mais antigo');
  assert.equal(g.estado().cortes[0].hz, 9000);
  assert.equal(g.estado().cortes.length, MAX_CORTES);
});

test('gerenciador: retorno que persiste com os 8 cortes por mais de 1 s abaixa a voz em 6 dB', () => {
  const g = new GerenciadorMicrofonia();
  let t = 0;
  for (let i = 0; i < MAX_CORTES; i++) g.aoDetectar({ hz: 500 + i * 400 }, (t += 100));
  let abaixou = null;
  for (let i = 0; i < 8 && !abaixou; i++) abaixou = g.aoDetectar({ hz: 500 + 7 * 400 }, (t += 400)).find((a) => a.tipo === 'abaixar');
  assert.ok(abaixou, 'não abaixou');
  assert.equal(abaixou.db, 6);
  assert.equal(g.estado().reducaoDb, 6);
  g.reiniciar();
  assert.equal(g.estado().cortes.length, 0);
  assert.equal(g.estado().reducaoDb, 0);
});

test('gerenciador: uma frequência só que continua mesmo com o corte no máximo também abaixa a voz', () => {
  const g = new GerenciadorMicrofonia();
  let t = 0;
  let abaixou = null;
  for (let i = 0; i < 12 && !abaixou; i++) abaixou = g.aoDetectar({ hz: 2500 }, (t += 400)).find((a) => a.tipo === 'abaixar');
  assert.ok(abaixou);
  assert.equal(g.estado().cortes.length, 1);
  assert.equal(g.estado().cortes[0].ganhoDb, PROFUNDIDADES_DB[PROFUNDIDADES_DB.length - 1]);
});

test('gerenciador: pausa de mais de 1,5 s sem detecção zera a contagem de saturação', () => {
  const g = new GerenciadorMicrofonia();
  let t = 0;
  for (let i = 0; i < MAX_CORTES; i++) g.aoDetectar({ hz: 500 + i * 400 }, (t += 100));
  g.aoDetectar({ hz: 3700 }, (t += 400));
  const depois = g.aoDetectar({ hz: 3700 }, (t += 2000));
  assert.equal(depois.find((a) => a.tipo === 'abaixar'), undefined);
});

test('retorno crescendo enquanto a pessoa canta: detecta a frequência do retorno, não a da voz', () => {
  const s = voz({ f0: 220, vibratoSt: 0.4, segundos: 2.5, seed: 77 });
  for (let i = 0; i < s.length; i++) s[i] += 0.002 * Math.pow(200, i / s.length) * Math.sin((2 * Math.PI * 3150 * i) / SR);
  const d = rodar(s);
  assert.ok(d.length > 0, 'não detectou');
  for (const x of d) assert.ok(Math.abs(x.hz - 3150) <= BIN_HZ, `hz ${x.hz}`);
});
