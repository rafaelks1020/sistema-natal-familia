import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Executar: node --test app/telao/karaoke/pontuacao.test.mjs. Sem banco, sem rede, sem navegador.
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pontuacao.ts');
const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const { hzParaMidi, nomeDaNota, desvioCents, medirRuido, limiarDeVoz, cantando, estrelasDaNota, pontuar } = mod.exports;

const PASSO = 33;
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// Gera 2 s de silêncio de ambiente (contagem) e depois a música. frases: [{de, ate, midi(t)}] em ms da música.
function serie({ musicaMs, frases, ruido = 0.003, rms = 0.08, clareza = 0.95 }) {
  const quadros = [];
  const inicio = 2000;
  for (let t = 0; t < inicio; t += PASSO) quadros.push({ t, hz: 0, clareza: 0.2, rms: ruido });
  for (let t = 0; t < musicaMs; t += PASSO) {
    const f = frases.find((x) => t >= x.de && t < x.ate);
    if (f) quadros.push({ t: inicio + t, hz: hz(f.midi(t)), clareza, rms });
    else quadros.push({ t: inicio + t, hz: 0, clareza: 0.2, rms: ruido });
  }
  return { quadros, inicio };
}

// Frases de 3 s seguidas por 1 s de pausa, notas cravadas no semitom.
function frasesCravadas(musicaMs, desvio = 0, vibrato = 0) {
  const frases = [];
  let i = 0;
  for (let de = 0; de < musicaMs; de += 4000, i++) {
    const base = 57 + (i % 5) * 2;
    frases.push({ de, ate: de + 3000, midi: (t) => base + desvio + vibrato * Math.sin(t / 60) });
  }
  return frases;
}

test('conversões de altura', () => {
  assert.equal(Math.round(hzParaMidi(440)), 69);
  assert.equal(nomeDaNota(69), 'Lá');
  assert.equal(nomeDaNota(60), 'Dó');
  assert.ok(desvioCents(60.5) > 49.9);
  assert.ok(desvioCents(60) < 0.001);
});

test('ruído medido nos 2 s iniciais e limiar com piso', () => {
  const qs = [];
  for (let t = 0; t < 4000; t += PASSO) qs.push({ t, hz: 0, clareza: 0.1, rms: t < 2000 ? 0.004 : 0.5 });
  assert.ok(Math.abs(medirRuido(qs) - 0.004) < 1e-9);
  assert.equal(limiarDeVoz(0.001), 0.01);
  assert.ok(Math.abs(limiarDeVoz(0.02) - 0.04) < 1e-9);
});

test('voz só conta com clareza, volume e faixa de frequência', () => {
  assert.equal(cantando({ t: 0, hz: 220, clareza: 0.9, rms: 0.05 }, 0.02), true);
  assert.equal(cantando({ t: 0, hz: 220, clareza: 0.7, rms: 0.05 }, 0.02), false);
  assert.equal(cantando({ t: 0, hz: 220, clareza: 0.9, rms: 0.01 }, 0.02), false);
  assert.equal(cantando({ t: 0, hz: 3000, clareza: 0.9, rms: 0.05 }, 0.02), false);
});

test('estrelas de 1 a 5', () => {
  assert.equal(estrelasDaNota(0), 1);
  assert.equal(estrelasDaNota(44), 1);
  assert.equal(estrelasDaNota(45), 2);
  assert.equal(estrelasDaNota(60), 3);
  assert.equal(estrelasDaNota(74), 4);
  assert.equal(estrelasDaNota(88), 5);
  assert.equal(estrelasDaNota(100), 5);
});

test('silêncio total dá zero e 1 estrela', () => {
  const { quadros, inicio } = serie({ musicaMs: 60000, frases: [] });
  const r = pontuar(quadros, 60000, inicio);
  assert.equal(r.nota, 0);
  assert.equal(r.estrelas, 1);
  assert.equal(r.detalhes.trechos, 0);
});

test('quem canta firme e no tom vai muito bem', () => {
  const { quadros, inicio } = serie({ musicaMs: 120000, frases: frasesCravadas(120000) });
  const r = pontuar(quadros, 120000, inicio);
  assert.ok(r.nota >= 88, `nota ${r.nota}`);
  assert.equal(r.estrelas, 5);
  assert.ok(r.detalhes.afinacao > 0.95);
  assert.ok(r.detalhes.cobertura > 0.7);
});

test('desafinado (entre dois semitons) cai, mas quem cantou tudo fica com 40 ou mais', () => {
  const afinado = pontuar(...(({ quadros, inicio }) => [quadros, 120000, inicio])(serie({ musicaMs: 120000, frases: frasesCravadas(120000) })));
  const torto = pontuar(...(({ quadros, inicio }) => [quadros, 120000, inicio])(serie({ musicaMs: 120000, frases: frasesCravadas(120000, 0.5, 0.25) })));
  assert.ok(torto.nota < afinado.nota, `${torto.nota} < ${afinado.nota}`);
  assert.ok(torto.nota >= 40, `nota ${torto.nota}`);
  assert.ok(torto.estrelas >= 2);
  assert.ok(torto.detalhes.afinacao < afinado.detalhes.afinacao);
  assert.ok(torto.detalhes.estabilidade < afinado.detalhes.estabilidade);
});

test('cantar só um pedacinho vale menos que cantar tudo', () => {
  const tudo = serie({ musicaMs: 120000, frases: frasesCravadas(120000) });
  const pouco = serie({ musicaMs: 120000, frases: frasesCravadas(120000).slice(0, 3) });
  const a = pontuar(tudo.quadros, 120000, tudo.inicio);
  const b = pontuar(pouco.quadros, 120000, pouco.inicio);
  assert.ok(b.nota < a.nota - 20, `${b.nota} vs ${a.nota}`);
  assert.ok(b.detalhes.cobertura < 0.15);
});

test('voz baixinha, perto do ruído, não conta como cantar', () => {
  const { quadros, inicio } = serie({ musicaMs: 60000, frases: frasesCravadas(60000), ruido: 0.02, rms: 0.025 });
  const r = pontuar(quadros, 60000, inicio);
  assert.equal(r.detalhes.cobertura, 0);
  assert.equal(r.nota, 0);
});

test('pausa no meio não conta como tempo cantando', () => {
  const { quadros, inicio } = serie({ musicaMs: 40000, frases: frasesCravadas(40000) });
  const comPausa = quadros.map((q) => (q.t > 20000 ? { ...q, t: q.t + 60000 } : q));
  const a = pontuar(quadros, 40000, inicio);
  const b = pontuar(comPausa, 40000, inicio);
  assert.equal(a.nota, b.nota);
});

test('nota sempre entre 0 e 100 e estrelas entre 1 e 5, com dados quebrados', () => {
  for (const q of [[], [{ t: 0, hz: NaN, clareza: 1, rms: 1 }], [{ t: 5, hz: 200, clareza: 1, rms: 1 }]]) {
    const r = pontuar(q, 1000);
    assert.ok(r.nota >= 0 && r.nota <= 100 && Number.isInteger(r.nota));
    assert.ok(r.estrelas >= 1 && r.estrelas <= 5);
  }
});

// ---------- modo letra: só contam os quadros dentro das linhas com texto ----------

// Linhas de 3 s a cada 4 s (como frasesCravadas), com uma pausa instrumental longa entre os 40 s e os 90 s.
function janelasComSolo() {
  const j = [];
  for (let de = 0; de < 40000; de += 4000) j.push({ de, ate: de + 3000 });
  for (let de = 90000; de < 130000; de += 4000) j.push({ de, ate: de + 3000 });
  return j;
}

// Série com m (posição do vídeo). cantaEm: quais janelas a pessoa canta; vozFora: voz (ou conversa) fora das linhas, em função do tempo.
function serieLetra({ musicaMs, janelas, cantaEm = () => true, vozFora = () => false }) {
  const quadros = [];
  const inicio = 2000;
  for (let t = 0; t < inicio; t += PASSO) quadros.push({ t, hz: 0, clareza: 0.2, rms: 0.003 });
  for (let t = 0; t < musicaMs; t += PASSO) {
    const idx = janelas.findIndex((j) => t >= j.de && t < j.ate);
    const canta = idx >= 0 ? cantaEm(idx) : vozFora(t);
    const midi = 57 + (Math.floor(t / 4000) % 5) * 2;
    if (canta) quadros.push({ t: inicio + t, m: t, hz: hz(midi), clareza: 0.95, rms: 0.08 });
    else quadros.push({ t: inicio + t, m: t, hz: 0, clareza: 0.2, rms: 0.003 });
  }
  return { quadros, inicio };
}

test('letra: cantar todas as linhas vale nota alta mesmo com solo longo sem letra', () => {
  const janelas = janelasComSolo();
  const { quadros, inicio } = serieLetra({ musicaMs: 130000, janelas });
  const comLetra = pontuar(quadros, 130000, inicio, janelas);
  const semLetra = pontuar(quadros, 130000, inicio);
  assert.equal(comLetra.detalhes.modo, 'letra');
  assert.ok(comLetra.nota >= 88, `nota ${comLetra.nota}`);
  assert.ok(comLetra.detalhes.cobertura > 0.7);
  assert.ok(comLetra.nota >= semLetra.nota, `${comLetra.nota} >= ${semLetra.nota}`);
});

test('letra: silêncio durante a letra derruba a nota', () => {
  const janelas = janelasComSolo();
  const nota = (cantaEm) => { const { quadros, inicio } = serieLetra({ musicaMs: 130000, janelas, cantaEm }); return pontuar(quadros, 130000, inicio, janelas); };
  const tudo = nota(() => true);
  const quase = nota((i) => i % 10 !== 0);
  const metade = nota((i) => i % 2 === 0);
  const pouco = nota((i) => i % 5 === 0);
  assert.ok(quase.nota <= tudo.nota, `${quase.nota} <= ${tudo.nota}`);
  assert.ok(quase.nota >= 85, `nota ${quase.nota}`);
  assert.ok(metade.nota < quase.nota - 8, `${metade.nota} vs ${quase.nota}`);
  assert.ok(pouco.nota < metade.nota - 8, `${pouco.nota} vs ${metade.nota}`);
  assert.ok(metade.detalhes.cobertura < tudo.detalhes.cobertura);
});

test('letra: voz no solo instrumental não conta nem pune', () => {
  const janelas = janelasComSolo();
  const noSolo = (t) => t >= 43000 && t < 88000;
  const base = serieLetra({ musicaMs: 130000, janelas });
  const falaNoSolo = serieLetra({ musicaMs: 130000, janelas, vozFora: noSolo });
  const a = pontuar(base.quadros, 130000, base.inicio, janelas);
  const b = pontuar(falaNoSolo.quadros, 130000, falaNoSolo.inicio, janelas);
  assert.equal(a.nota, b.nota);
  // Só cantou no solo e ficou calado durante a letra: nota zero.
  const soSolo = serieLetra({ musicaMs: 130000, janelas, cantaEm: () => false, vozFora: noSolo });
  const c = pontuar(soSolo.quadros, 130000, soSolo.inicio, janelas);
  assert.equal(c.nota, 0);
  assert.equal(c.detalhes.cobertura, 0);
});

test('letra: encerrar antes do fim conta só as linhas que já tocaram', () => {
  const janelas = janelasComSolo();
  const { quadros, inicio } = serieLetra({ musicaMs: 130000, janelas });
  const cortada = quadros.filter((q) => q.m === undefined || q.m < 20000);
  const r = pontuar(cortada, 20000, inicio, janelas);
  assert.ok(r.nota >= 88, `nota ${r.nota}`);
  assert.ok(r.detalhes.cobertura > 0.7);
});

test('letra: sem posição do vídeo nos quadros (m) cai na nota da música inteira', () => {
  const janelas = janelasComSolo();
  const { quadros, inicio } = serie({ musicaMs: 130000, frases: frasesCravadas(130000) });
  const a = pontuar(quadros, 130000, inicio);
  const b = pontuar(quadros, 130000, inicio, janelas);
  assert.equal(a.nota, b.nota);
  assert.notEqual(b.detalhes.modo, 'letra');
});

test('letra: janelas inválidas ou vazias são ignoradas', () => {
  const { quadros, inicio } = serieLetra({ musicaMs: 20000, janelas: [{ de: 0, ate: 3000 }] });
  const a = pontuar(quadros, 20000, inicio);
  assert.equal(pontuar(quadros, 20000, inicio, []).nota, a.nota);
  assert.equal(pontuar(quadros, 20000, inicio, [{ de: 5, ate: 5 }, { de: NaN, ate: 10 }]).nota, a.nota);
});
