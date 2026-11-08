import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const carregar = (nome) => {
  const js = ts.transpileModule(fs.readFileSync(new URL(nome, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} }; new Function('module', 'exports', js)(mod, mod.exports); return mod.exports;
};
const { analisarSuspeita, processarLote } = carregar('./prova-seguranca.ts');

// Gerador determinístico (mulberry32) para repetir os "cantores".
const sorteio = (semente) => () => { semente |= 0; semente = (semente + 0x6D2B79F5) | 0; let t = Math.imul(semente ^ (semente >>> 15), 1 | semente); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
// Música de ~3 min: 70 notas de 2,4 s, alturas entre 55 e 69.
const notas = Array.from({ length: 70 }, (_, i) => ({ inicio_ms: i * 2500, dur_ms: 2400, midi: 55 + ((i * 7) % 15), linha: Math.floor(i / 4), golden: false }));
const hzDe = (midi, cents) => 440 * 2 ** ((midi - 69 + cents / 100) / 12);

/** Cantor humano: vibrato, deriva, afinação meio torta, volume e clareza que variam, relógio com jitter. */
function cantorReal(semente, { vibrato = 18, deriva = 14, erroNota = 12 } = {}) {
  const r = sorteio(semente);
  const quadros = []; let t = 0; let faseVib = r() * 6;
  for (const n of notas) {
    const desvioNota = gauss(r) * erroNota; let drift = 0;
    for (let ms = 0; ms < n.dur_ms; ms += 33) {
      t += 33 + gauss(r) * 1.6; faseVib += 0.2;
      drift = drift * 0.9 + gauss(r) * deriva * 0.3;
      const falou = r() < 0.12; // quadro sem voz / ruído
      const clareza = falou ? 0.2 + r() * 0.2 : Math.min(1, Math.max(0.5, 0.78 + 0.1 * Math.sin(ms / 400) + gauss(r) * 0.07));
      const rms = Math.max(0.006, 0.05 + 0.03 * Math.sin(ms / 900 + n.midi) + Math.abs(gauss(r)) * 0.025);
      quadros.push({ t, m: n.inicio_ms + ms + 140 + gauss(r) * 2.5, hz: falou ? 0 : hzDe(n.midi, desvioNota + drift + vibrato * Math.sin(faseVib)), clareza, rms });
    }
  }
  return quadros;
}
/** Quadros fabricados por script: exatamente a nota, constantes, relógio perfeito. */
const gerador = () => {
  const quadros = [];
  for (const n of notas) for (let ms = 0; ms < n.dur_ms; ms += 33) { const t = n.inicio_ms + ms; quadros.push({ t, m: t + 140, hz: hzDe(n.midi, 0), clareza: 0.99, rms: 0.1 }); }
  return quadros;
};

test('cantores realistas (vários, inclusive muito bons) não são marcados', () => {
  for (let semente = 1; semente <= 25; semente++) assert.deepEqual(analisarSuspeita(cantorReal(semente), notas, 82), [], `semente ${semente}`);
  for (let semente = 100; semente < 110; semente++) assert.deepEqual(analisarSuspeita(cantorReal(semente, { vibrato: 10, deriva: 8, erroNota: 6 }), notas, 91), [], `bom ${semente}`);
});
test('gerador perfeito dispara clareza, volume, afinação, tempo e posição', () => {
  const m = analisarSuspeita(gerador(), notas, 100).join(' | ');
  for (const trecho of [/Clareza quase constante/, /Volume quase constante/, /Afinação perfeita demais/, /Intervalos de tempo regulares/, /Posição do áudio/, /Nota 100/]) assert.match(m, trecho);
});
test('nota 97 ou mais marca mesmo com voz humana; 96 não', () => {
  assert.equal(analisarSuspeita(cantorReal(7), notas, 97).length, 1);
  assert.equal(analisarSuspeita(cantorReal(7), notas, 96).length, 0);
});
test('tentativa curta ou vazia não dispara testes estatísticos', () => {
  assert.deepEqual(analisarSuspeita([], notas, 0), []);
  assert.deepEqual(analisarSuspeita(gerador().slice(0, 100), notas, 12), []);
});
test('gerador que só varia o tempo ainda é pego pela afinação e pelo volume', () => {
  const r = sorteio(3);
  const q = gerador().map((f) => ({ ...f, t: f.t + r() * 4, m: f.m + r() * 4 }));
  const m = analisarSuspeita(q, notas, 90).join(' | ');
  assert.match(m, /Afinação perfeita/); assert.match(m, /Volume quase constante/); assert.doesNotMatch(m, /Intervalos de tempo/);
});

const estado = { ultimo: -1, posicao: 0, duracaoMs: 4000, decorridoMs: 10000 };
const bom = (t, m = t + 100) => ({ t, m, hz: 220, clareza: 0.9, rms: 0.1 });
test('lote: quadro inválido é descartado e o resto segue', () => {
  const r = processarLote([bom(0), { t: 33, m: 133, hz: NaN, clareza: 0.9, rms: 0.1 }, null, 'x', { ...bom(66), clareza: 3 }, bom(99)], estado);
  assert.equal(r.novos.length, 2); assert.equal(r.descartados, 4); assert.equal(r.ultimo, 99); assert.equal(r.salto, false);
  assert.equal(r.loteAteT, 99);
});
test('lote: descartado no fim avança lote_ate_t sem virar quadro aceito', () => {
  const r = processarLote([bom(0), { ...bom(33), rms: 9 }], estado);
  assert.equal(r.ultimo, 0); assert.equal(r.loteAteT, 33); assert.equal(r.descartados, 1);
});
test('lote: reenvio é ignorado e devolve o último aceito para retomar', () => {
  const r = processarLote([bom(0), bom(33), bom(66)], { ...estado, ultimo: 33, posicao: 133 });
  assert.deepEqual(r.novos.map((q) => q.t), [66]); assert.equal(r.ultimo, 66); assert.equal(r.descartados, 0);
});
test('lote: só salto de posição impossível sinaliza (voltar, ou passar do relógio)', () => {
  assert.equal(processarLote([bom(0, 2000), bom(33, 500)], estado).salto, true);
  assert.equal(processarLote([bom(0), bom(33, 9999)], { ...estado, duracaoMs: 20000 }).salto, false);
  assert.equal(processarLote([bom(0), bom(33, 10500)], { ...estado, duracaoMs: 20000 }).salto, true);
  assert.equal(processarLote([bom(0, 2000), bom(33, 1900)], estado).salto, false);
  assert.equal(processarLote([bom(0, 1000)], { ...estado, decorridoMs: 500 }).descartados, 0);
});
test('lote: instante no futuro (além do relógio do servidor) é descartado', () => {
  const r = processarLote([bom(0), bom(20000, 100)], estado);
  assert.equal(r.descartados, 1); assert.equal(r.novos.length, 1);
});
