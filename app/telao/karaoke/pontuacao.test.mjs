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
const { hzParaMidi, nomeDaNota, desvioCents, medirRuido, limiarDeVoz, cantando, estrelasDaNota, pontuar, pontuarEstudio, erroEmSemitons, fatorDeAcerto, notaEm, estrelasEstudio, PontuacaoAoVivo, multiplicadorDeCombo, PlateiaEnergia, forcaEstudio, forcaLetra } = mod.exports;
const { NIVEIS, reguaDoNivel } = mod.exports;

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

// ---------- modo estúdio ----------

// 8 notas de 2 s (a 1ª linha tem 4, a 2ª tem 4), com pausa de 500 ms entre elas.
function melodia({ golden = [] } = {}) {
  const notas = [];
  for (let i = 0; i < 8; i++) notas.push({ inicio_ms: 1000 + i * 2500, dur_ms: 2000, midi: 60 + (i % 4) * 2, golden: golden.includes(i), linha: i < 4 ? 0 : 1 });
  return notas;
}
// Voz seguindo a melodia: cada quadro traz m (posição do áudio) = tempo da nota + latência.
function vozEstudio(notas, { desvio = 0, oitava = 0, latencia = 80, clareza = 0.95, quando = () => true } = {}) {
  const quadros = [];
  for (let t = 0; t < 2000; t += PASSO) quadros.push({ t, hz: 0, clareza: 0.2, rms: 0.003, m: t });
  const fim = 22000;
  for (let m = 0; m < fim; m += PASSO) {
    const tn = m - latencia;
    const idx = notas.findIndex((n) => tn >= n.inicio_ms && tn < n.inicio_ms + n.dur_ms);
    if (idx >= 0 && quando(idx)) quadros.push({ t: 2000 + m, hz: hz(notas[idx].midi + desvio + oitava * 12), clareza, rms: 0.08, m });
    else quadros.push({ t: 2000 + m, hz: 0, clareza: 0.2, rms: 0.003, m });
  }
  return quadros;
}

test('estúdio: erro em semitons ignora a oitava', () => {
  assert.equal(erroEmSemitons(60, 60), 0);
  assert.ok(Math.abs(erroEmSemitons(72.3, 60) - 0.3) < 1e-9);
  assert.ok(Math.abs(erroEmSemitons(48.6, 60) - 0.6) < 1e-9);
  assert.equal(erroEmSemitons(66, 60), 6);
  assert.ok(Math.abs(erroEmSemitons(59.2, 60) - 0.8) < 1e-9);
});

test('estúdio: fator de acerto vale 1 até 0,5 semitom, cai até 0 em 1,5', () => {
  assert.equal(fatorDeAcerto(0), 1);
  assert.equal(fatorDeAcerto(0.5), 1);
  assert.ok(Math.abs(fatorDeAcerto(1) - 0.5) < 1e-9);
  assert.equal(fatorDeAcerto(1.5), 0);
  assert.equal(fatorDeAcerto(4), 0);
});

test('estúdio: notaEm acha a nota que cobre o instante', () => {
  const notas = melodia();
  assert.equal(notaEm(notas, 500), -1);
  assert.equal(notaEm(notas, 1000), 0);
  assert.equal(notaEm(notas, 2999), 0);
  assert.equal(notaEm(notas, 3200), -1);
  assert.equal(notaEm(notas, 3500), 1);
});

test('estúdio: cantar cravado na melodia dá nota máxima', () => {
  const notas = melodia();
  const r = pontuarEstudio(vozEstudio(notas), notas, 80);
  assert.ok(r.nota >= 97, `nota ${r.nota}`);
  assert.equal(r.estrelas, 5);
  assert.equal(r.detalhes.modo, 'estudio');
  assert.equal(r.linhas.length, 2);
  assert.ok(r.linhas.every((p) => p > 0.95));
});

test('estúdio: silêncio dá zero', () => {
  const notas = melodia();
  const r = pontuarEstudio(vozEstudio(notas, { quando: () => false }), notas, 80);
  assert.equal(r.nota, 0);
  assert.equal(r.estrelas, 1);
  assert.equal(r.total, 0);
});

test('estúdio: sem notas não quebra', () => {
  const r = pontuarEstudio(vozEstudio(melodia()), [], 80);
  assert.equal(r.nota, 0);
  assert.deepEqual(r.linhas, []);
});

test('estúdio: oitava abaixo ou acima conta igual', () => {
  const notas = melodia();
  const a = pontuarEstudio(vozEstudio(notas), notas, 80).nota;
  assert.equal(pontuarEstudio(vozEstudio(notas, { oitava: -1 }), notas, 80).nota, a);
  assert.equal(pontuarEstudio(vozEstudio(notas, { oitava: 1 }), notas, 80).nota, a);
});

test('estúdio: desafinar 3 semitons zera os pontos; meio semitom ainda é cheio', () => {
  const notas = melodia();
  assert.ok(pontuarEstudio(vozEstudio(notas, { desvio: 3 }), notas, 80).nota <= 2);
  assert.ok(pontuarEstudio(vozEstudio(notas, { desvio: 0.45 }), notas, 80).nota >= 97);
  // 1,25 semitom: 25% do ponto; contra a cobertura esperada de 50%, meio acerto por nota.
  const meio = pontuarEstudio(vozEstudio(notas, { desvio: 1.25 }), notas, 80).nota;
  assert.ok(meio > 40 && meio < 60, `nota ${meio}`);
});

test('estúdio: a latência do microfone é descontada', () => {
  const notas = melodia();
  const atrasada = vozEstudio(notas, { latencia: 200 });
  const estrito = { cobertura: 1, gracaMs: 0 };
  const certa = pontuarEstudio(atrasada, notas, 200, 0, estrito).nota;
  const errada = pontuarEstudio(atrasada, notas, 0, 0, estrito).nota;
  assert.ok(certa >= 97, `nota ${certa}`);
  assert.ok(errada < certa);
});

test('estúdio: o ajuste de sincronia desloca as notas', () => {
  const notas = melodia();
  const q = vozEstudio(notas, { latencia: 80 + 250 });
  const estrito = { cobertura: 1, gracaMs: 0 };
  assert.ok(pontuarEstudio(q, notas, 80, 250, estrito).nota >= 97);
  assert.ok(pontuarEstudio(q, notas, 80, 0, estrito).nota < 97);
});

test('estúdio: quadros sem clareza ou abaixo do ruído não contam', () => {
  const notas = melodia();
  assert.equal(pontuarEstudio(vozEstudio(notas, { clareza: 0.4 }), notas, 80).nota, 0);
  const baixo = vozEstudio(notas).map((q) => (q.t >= 2000 ? { ...q, rms: q.hz ? 0.001 : q.rms } : q));
  assert.equal(pontuarEstudio(baixo, notas, 80).nota, 0);
});

test('estúdio: nota golden vale o dobro', () => {
  const notas = melodia({ golden: [0] });
  // Acerta só a nota 0 (golden, peso 2 x 2000) ou só a nota 1 (normal, 2000): a golden rende o dobro.
  const soGolden = pontuarEstudio(vozEstudio(notas, { quando: (i) => i === 0 }), notas, 80);
  const soNormal = pontuarEstudio(vozEstudio(notas, { quando: (i) => i === 1 }), notas, 80);
  assert.ok(soGolden.total > soNormal.total * 1.8, `${soGolden.total} x ${soNormal.total}`);
});

test('estúdio: bônus de linha premia linha perfeita', () => {
  const notas = melodia();
  const umaLinha = pontuarEstudio(vozEstudio(notas, { quando: (i) => i < 4 }), notas, 80);
  assert.ok(umaLinha.linhas[0] > 0.95);
  assert.equal(umaLinha.linhas[1], 0);
  assert.ok(umaLinha.detalhes.bonus > 450 && umaLinha.detalhes.bonus < 520, `bônus ${umaLinha.detalhes.bonus}`);
  assert.ok(umaLinha.nota >= 45 && umaLinha.nota <= 52, `nota ${umaLinha.nota}`);
});

test('estúdio: estrelas por faixas', () => {
  assert.deepEqual([0, 34, 35, 54, 55, 69, 70, 84, 85, 100].map(estrelasEstudio), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
});

test('estúdio: quadros sem posição (m) não contam', () => {
  const notas = melodia();
  const sem = vozEstudio(notas).map((q) => ({ t: q.t, hz: q.hz, clareza: q.clareza, rms: q.rms }));
  assert.equal(pontuarEstudio(sem, notas, 80).nota, 0);
});

// ---------- pontuação ao vivo, sequência e plateia ----------

// n notas de 1 s (pausa de 200 ms), 4 por linha, midi variando.
function melodiaLonga(n) {
  return Array.from({ length: n }, (_, i) => ({ inicio_ms: 2500 + i * 1200, dur_ms: 1000, midi: 55 + (i % 5) * 2, golden: i % 7 === 3, linha: Math.floor(i / 4) }));
}
// Quadros (já com m) cantando as notas escolhidas por acerta(i); ruído nos 2 primeiros segundos.
function quadrosLongos(notas, { acerta = () => true, latencia = 80 } = {}) {
  const quadros = [];
  const fim = notas[notas.length - 1].inicio_ms + notas[notas.length - 1].dur_ms + 3000;
  for (let m = 0; m < fim; m += PASSO) {
    const tn = m - latencia;
    const idx = notas.findIndex((x) => tn >= x.inicio_ms && tn < x.inicio_ms + x.dur_ms);
    const canta = idx >= 0 && acerta(idx);
    quadros.push({ t: m, hz: canta ? hz(notas[idx].midi) : 0, clareza: canta ? 0.95 : 0.2, rms: canta ? 0.08 : 0.003, m });
  }
  return quadros;
}
function alimentar(motor, quadros) {
  const eventos = [];
  let anterior = 0;
  for (const q of quadros) {
    const valido = q.hz > 0;
    eventos.push(...motor.adicionarQuadro(q.m, valido ? hzParaMidi(q.hz) : null, q.clareza, q.rms, PASSO));
    const e = motor.estado();
    assert.ok(e.pontos >= anterior, 'o placar nunca desce');
    assert.ok(e.pontos <= 10000);
    anterior = e.pontos;
  }
  return eventos;
}

test('ao vivo: sequência x1, x2 (5), x3 (10), x4 (20)', () => {
  assert.deepEqual([0, 4, 5, 9, 10, 19, 20, 99].map(multiplicadorDeCombo), [1, 1, 2, 2, 3, 3, 4, 4]);
});

test('ao vivo: placar incremental termina igual à pontuação em lote', () => {
  const notas = melodiaLonga(24);
  const quadros = quadrosLongos(notas, { acerta: (i) => i % 6 !== 5 });
  const motor = new PontuacaoAoVivo(notas, { latenciaMs: 80 });
  alimentar(motor, quadros);
  const final = motor.resultado();
  const lote = pontuarEstudio(quadros, notas, 80);
  assert.equal(final.nota, lote.nota);
  assert.equal(final.total, lote.total);
  assert.deepEqual(final.linhas, lote.linhas);
  assert.deepEqual(final.resumo, lote.resumo);
  assert.equal(motor.estado().pontos, Math.min(10000, Math.round(final.total)));
});

test('ao vivo: a conta bate com a fórmula feita à mão', () => {
  // 4 notas normais perfeitas numa linha só: 9000 + 1000 de bônus da linha, sem sequência (menos de 5).
  const notas = melodiaLonga(4).map((n) => ({ ...n, golden: false, linha: 0 }));
  const motor = new PontuacaoAoVivo(notas, { latenciaMs: 80 });
  alimentar(motor, quadrosLongos(notas));
  const r = motor.resultado();
  assert.ok(r.total > 9900 && r.total <= 10000, `total ${r.total}`);
  assert.equal(r.resumo.maiorCombo, 1);
  assert.equal(r.detalhes.comboPontos, 0);
});

test('ao vivo: bônus de sequência é explícito, limitado a 1500 e entra na nota final', () => {
  const notas = melodiaLonga(40).map((n) => ({ ...n, golden: false }));
  const motor = new PontuacaoAoVivo(notas, { latenciaMs: 80 });
  alimentar(motor, quadrosLongos(notas));
  const e = motor.estado();
  motor.encerrar();
  const f = motor.estado();
  assert.ok(f.pontosSequencia > 600 && f.pontosSequencia <= 1500, `sequência ${f.pontosSequencia}`);
  assert.equal(f.maiorCombo, 4);
  assert.equal(f.maiorSequencia, 40);
  assert.equal(f.pontos, 10000);
  assert.equal(motor.resultado().nota, 100);
  assert.ok(e.pontos <= f.pontos);
  const sem = pontuarEstudio(quadrosLongos(notas), notas.slice(0, 4), 80);
  assert.equal(sem.detalhes.comboPontos, 0);
});

test('ao vivo: errar uma nota quebra a sequência e avisa', () => {
  const notas = melodiaLonga(12).map((n) => ({ ...n, golden: false }));
  const motor = new PontuacaoAoVivo(notas, { latenciaMs: 80 });
  const eventos = alimentar(motor, quadrosLongos(notas, { acerta: (i) => i !== 7 }));
  const doTipo = eventos.filter((e) => e.tipo === 'nota');
  assert.equal(doTipo.length, 11 + 1 - 0);
  assert.equal(doTipo[6].combo, 2);
  assert.equal(doTipo[7].quebrou, true);
  assert.equal(doTipo[7].combo, 1);
  assert.equal(doTipo[7].sequencia, 0);
  assert.equal(motor.estado().maiorSequencia, 7);
});

test('ao vivo: eventos de linha e estrela', () => {
  const notas = melodiaLonga(8).map((n) => ({ ...n, golden: false }));
  const motor = new PontuacaoAoVivo(notas, { latenciaMs: 80 });
  const eventos = alimentar(motor, quadrosLongos(notas, { acerta: (i) => i < 4 }));
  eventos.push(...motor.encerrar());
  const linhas = eventos.filter((e) => e.tipo === 'linha');
  assert.equal(linhas.length, 2);
  assert.ok(linhas[0].perfeicao > 0.95 && linhas[0].pontos > 4000);
  assert.equal(linhas[1].perfeicao, 0);
  assert.equal(eventos.filter((e) => e.tipo === 'estrela').length, 4);
});

test('ao vivo: silêncio e quadros inválidos não pontuam; ultimoQuadro informa a nota', () => {
  const notas = melodiaLonga(6);
  const motor = new PontuacaoAoVivo(notas, { latenciaMs: 0 });
  motor.adicionarQuadro(3000, 55, 0.4, 0.08, PASSO);
  assert.equal(motor.ultimoQuadro.valido, false);
  assert.equal(motor.ultimoQuadro.indice, 0);
  motor.adicionarQuadro(3033, 55, 0.95, 0.001, PASSO);
  assert.equal(motor.estado().pontos, 0);
  motor.adicionarQuadro(3066, 55, 0.95, 0.08, PASSO);
  assert.equal(motor.ultimoQuadro.valido, true);
  assert.equal(motor.ultimoQuadro.fator, 1);
  assert.ok(motor.estado().pontos > 0);
});

test('plateia: sobe cantando certo, cai no silêncio e fica entre 0 e 1', () => {
  const p = new PlateiaEnergia();
  for (let i = 0; i < 300; i++) p.atualizar(33, 1);
  assert.equal(p.nivel, 1);
  for (let i = 0; i < 600; i++) p.atualizar(33, -1);
  assert.equal(p.nivel, 0);
  const q = new PlateiaEnergia(0.5);
  q.atualizar(1000, 1);
  assert.ok(Math.abs(q.nivel - 0.74) < 1e-9);
});

test('plateia: forças do modo estúdio e do modo letra', () => {
  assert.equal(forcaEstudio({ indice: 2, fator: 1, valido: true }), 1);
  assert.equal(forcaEstudio({ indice: 2, fator: 0, valido: true }), -0.7);
  assert.equal(forcaEstudio({ indice: 2, fator: 0, valido: false }), -0.8);
  assert.equal(forcaEstudio({ indice: -1, fator: 0, valido: false }), -0.15);
  assert.equal(forcaEstudio({ indice: -1, fator: 0, valido: true }), 0);
  assert.equal(forcaLetra(true, true), 0.6);
  assert.equal(forcaLetra(true, false), -0.6);
  assert.equal(forcaLetra(false, false), -0.15);
});

// ---------- calibração com voz real (scripts/karaoke-diagnostico.mjs) ----------

test('estúdio: voz que cobre metade da nota com tom certo já enche a nota (consoantes e respiração não têm tom)', () => {
  const notas = melodia();
  // canta só os primeiros 55% de cada nota
  const quadros = vozEstudio(notas, { quando: () => true }).map((q) => {
    const idx = notas.findIndex((n) => q.m - 80 >= n.inicio_ms && q.m - 80 < n.inicio_ms + n.dur_ms);
    if (idx < 0) return q;
    const dentro = (q.m - 80 - notas[idx].inicio_ms) / notas[idx].dur_ms;
    return dentro < 0.55 ? q : { ...q, hz: 0, clareza: 0.2, rms: 0.003 };
  });
  const r = pontuarEstudio(quadros, notas, 80);
  assert.ok(r.nota >= 95, `nota ${r.nota}`);
});

test('estúdio: clareza de voz cantada (0,5 a 0,8) vale; abaixo de 0,5 não', () => {
  const notas = melodia();
  assert.ok(pontuarEstudio(vozEstudio(notas, { clareza: 0.6 }), notas, 80).nota >= 97);
  assert.equal(pontuarEstudio(vozEstudio(notas, { clareza: 0.45 }), notas, 80).nota, 0);
});

test('estúdio: tolerância de tempo de 100 ms nas bordas das notas', () => {
  const notas = melodia();
  // voz 90 ms adiantada em relação à latência declarada: ainda dentro da graça
  const quadros = vozEstudio(notas, { latencia: 80 - 90 });
  const com = pontuarEstudio(quadros, notas, 80).nota;
  const sem = pontuarEstudio(quadros, notas, 80, 0, { gracaMs: 0, cobertura: 1 }).nota;
  assert.ok(com >= 95, `nota ${com}`);
  assert.ok(sem < com);
});

test('estúdio: tom fixo contra uma melodia que anda quase não pontua; melodia parada pontua', () => {
  const ciclo = [60, 64, 67, 62, 65, 69];
  const notas = Array.from({ length: 60 }, (_, i) => ({ inicio_ms: 2500 + i * 500, dur_ms: 400, midi: ciclo[i % ciclo.length], golden: false, linha: Math.floor(i / 6) }));
  const fim = notas[notas.length - 1].inicio_ms + 3000;
  const tom = [];
  for (let m = 0; m < fim; m += PASSO) tom.push(m < 2000 ? { t: m, hz: 0, clareza: 0.2, rms: 0.003, m } : { t: m, hz: hz(60), clareza: 0.99, rms: 0.1, m });
  const r = pontuarEstudio(tom, notas, 80);
  assert.ok(r.nota < 25, `nota ${r.nota}`);
  // o mesmo tom contra uma melodia que fica nele: nota alta (não é punição à toa)
  const parada = notas.map((n) => ({ ...n, midi: 60 }));
  assert.ok(pontuarEstudio(tom, parada, 80).nota >= 90);
});

test('estúdio: notas curtas (< 150 ms) valem pontos mas não quebram a sequência', () => {
  const notas = melodiaLonga(12).map((n) => ({ ...n, golden: false }));
  notas[5] = { ...notas[5], dur_ms: 100 };
  const motor = new PontuacaoAoVivo(notas, { latenciaMs: 80 });
  alimentar(motor, quadrosLongos(notas, { acerta: (i) => i !== 5 }));
  motor.encerrar();
  assert.equal(motor.estado().maiorSequencia, 11);
});

test('estúdio: limiar de voz do estúdio fica entre 0,008 e 0,03', async () => {
  const { limiarDeVozEstudio } = mod.exports;
  assert.equal(limiarDeVozEstudio(0), 0.008);
  assert.equal(limiarDeVozEstudio(0.1), 0.03);
  assert.ok(Math.abs(limiarDeVozEstudio(0.01) - 0.02) < 1e-9);
});

// ---------- Modo Estrela: multiplicador de pontos das notas por janela de tempo ----------

function rodarEstrela(notas, { acerta, janelas = [] }) {
  const motor = new PontuacaoAoVivo(notas, { latenciaMs: 80 });
  for (const j of janelas) motor.iniciarEstrela(j.de, j.dur, j.mult);
  alimentar(motor, quadrosLongos(notas, { acerta }));
  return motor;
}

test('estrela: sem janela nada muda (estado idêntico ao de antes)', () => {
  const notas = melodiaLonga(24);
  const a = rodarEstrela(notas, { acerta: (i) => i % 2 === 0 });
  const e = a.estado();
  assert.equal(e.pontosEstrela, 0);
  assert.equal(a.multiplicadorEstrela(1000), 1);
  assert.equal(a.estrelaAtiva(1000), false);
  const r = a.resultado();
  assert.equal(r.detalhes.estrelaPontos, undefined);
});

test('estrela: janela cobrindo a música toda dobra os pontos das notas', () => {
  const notas = melodiaLonga(24);
  const base = rodarEstrela(notas, { acerta: (i) => i % 2 === 0 }).estado();
  const dobro = rodarEstrela(notas, { acerta: (i) => i % 2 === 0, janelas: [{ de: 0, dur: 1e9, mult: 2 }] }).estado();
  assert.ok(base.pontosNotas > 1000 && base.pontosNotas < 9000, `base ${base.pontosNotas}`);
  assert.ok(Math.abs(dobro.pontosNotas - 2 * base.pontosNotas) < 1, `dobro ${dobro.pontosNotas} base ${base.pontosNotas}`);
  assert.ok(Math.abs(dobro.pontosEstrela - base.pontosNotas) < 1);
  // acerto, sequência e linhas não mudam
  assert.equal(dobro.pontosSequencia, base.pontosSequencia);
  assert.equal(dobro.pontosLinhas, base.pontosLinhas);
  assert.equal(dobro.maiorSequencia, base.maiorSequencia);
});

test('estrela: só vale dentro da janela de tempo (8 s no meio da música)', () => {
  const notas = melodiaLonga(24);
  const meio = notas[10].inicio_ms;
  const todas = (i) => i >= 0;
  const base = rodarEstrela(notas, { acerta: todas }).estado();
  // a janela de 8 s pega só parte das notas: ganho extra positivo e menor que o de uma janela infinita
  const parcial = rodarEstrela(notas, { acerta: todas, janelas: [{ de: meio, dur: 8000, mult: 2 }] }).estado();
  const total = rodarEstrela(notas, { acerta: todas, janelas: [{ de: 0, dur: 1e9, mult: 2 }] }).estado();
  assert.ok(parcial.pontosEstrela > 0, `parcial ${parcial.pontosEstrela}`);
  assert.ok(parcial.pontosEstrela < total.pontosEstrela, 'janela curta dá menos extra');
  assert.ok(parcial.pontosNotas > base.pontosNotas);
  // janela depois do fim da música: sem efeito
  const depois = rodarEstrela(notas, { acerta: todas, janelas: [{ de: 10_000_000, dur: 8000, mult: 2 }] }).estado();
  assert.equal(depois.pontosEstrela, 0);
  assert.equal(depois.pontosNotas, base.pontosNotas);
});

test('estrela: multiplicador por tempo é explícito (borda inicial incluída, final excluída) e não acumula janelas', () => {
  const motor = new PontuacaoAoVivo(melodiaLonga(4), { latenciaMs: 80 });
  motor.iniciarEstrela(1000, 8000);
  assert.equal(motor.multiplicadorEstrela(999), 1);
  assert.equal(motor.multiplicadorEstrela(1000), 2);
  assert.equal(motor.multiplicadorEstrela(8999), 2);
  assert.equal(motor.multiplicadorEstrela(9000), 1);
  motor.iniciarEstrela(5000, 8000); // sobrepõe: continua x2, não x4
  assert.equal(motor.multiplicadorEstrela(6000), 2);
  assert.equal(motor.multiplicadorEstrela(12000), 2);
  motor.iniciarEstrela(Number.NaN); motor.iniciarEstrela(0, 0); motor.iniciarEstrela(0, 1000, 1); // entradas inválidas são ignoradas
  assert.equal(motor.multiplicadorEstrela(100), 1);
});

test('estrela: o limite final de 10000 continua valendo e a nota final inclui o extra', () => {
  const notas = melodiaLonga(40).map((n) => ({ ...n, golden: false }));
  const motor = rodarEstrela(notas, { acerta: () => true, janelas: [{ de: 0, dur: 1e9, mult: 2 }] });
  const e = motor.estado();
  assert.equal(e.pontos, 10000);
  assert.ok(e.bruto > 10000, `bruto ${e.bruto}`);
  const r = motor.resultado();
  assert.equal(r.total, 10000);
  assert.equal(r.nota, 100);
  assert.ok(r.detalhes.estrelaPontos > 0);

  // cantor mediano: o extra entra no total final (e na nota), que fica abaixo do limite
  const base = rodarEstrela(notas, { acerta: (i) => i % 3 !== 0 }).resultado();
  const comEstrela = rodarEstrela(notas, { acerta: (i) => i % 3 !== 0, janelas: [{ de: notas[10].inicio_ms, dur: 8000, mult: 2 }] }).resultado();
  assert.ok(comEstrela.total > base.total, `${comEstrela.total} contra ${base.total}`);
  assert.ok(comEstrela.total <= 10000);
  assert.ok(comEstrela.nota >= base.nota);
  assert.equal(comEstrela.detalhes.estrelaPontos > 0, true);
});

// ---------- níveis de dificuldade ----------

test('níveis: seletor e réguas públicas têm as tolerâncias combinadas', () => {
  assert.deepEqual(NIVEIS.map((n) => n.valor), ['facil', 'normal', 'dificil']);
  assert.deepEqual(NIVEIS.map((n) => n.rotulo), ['Fácil', 'Normal', 'Difícil']);
  assert.ok(NIVEIS.every((n) => n.descricao.length > 0));
  assert.deepEqual(NIVEIS.map((n) => [reguaDoNivel(n.valor).erroZero, reguaDoNivel(n.valor).erroCheio]), [[2, 0.8], [1.5, 0.5], [0.8, 0.25]]);
  assert.equal(reguaDoNivel(), reguaDoNivel('normal'));
});

test('níveis: Normal explícito e padrão preservam o resultado anterior completo', () => {
  const notas = melodiaLonga(12);
  const quadros = quadrosLongos(notas, { acerta: (i) => i !== 7 }).map((q) => q.hz ? { ...q, hz: q.hz * 2 ** (0.85 / 12) } : q);
  const anterior = {
    nota: 94, estrelas: 5, total: 9381, linhas: [1, 0.75, 1],
    resumo: { maiorCombo: 2, maiorSequencia: 7, perfeitas: 11, notas: 12, perfeitasPct: 0.917, pontos: 9381 },
    detalhes: { cobertura: 0.916, afinacao: 0.65, estabilidade: 0, energia: 0, trechos: 11, ruido: 0.003, limiar: 0.008, modo: 'estudio', total: 9381, bonus: 916.7, comboPontos: 107.1, maiorCombo: 2, maiorSequencia: 7, perfeitas: 11 },
  };
  assert.deepEqual(pontuarEstudio(quadros, notas, 80), anterior);
  assert.deepEqual(pontuarEstudio(quadros, notas, 80, 0, { nivel: 'normal' }), anterior);
});

test('níveis: mesma performance dá Fácil >= Normal >= Difícil, ao vivo e em lote', () => {
  const notas = melodiaLonga(24);
  for (const desvio of [0, 0.3, 0.7, 0.85, 1.25, 1.8, 3]) {
    const quadros = quadrosLongos(notas, { acerta: (i) => i % 6 !== 5 }).map((q) => q.hz ? { ...q, hz: q.hz * 2 ** (desvio / 12) } : q);
    const resultados = NIVEIS.map(({ valor: nivel }) => {
      const motor = new PontuacaoAoVivo(notas, { latenciaMs: 80, nivel });
      alimentar(motor, quadros);
      const vivo = motor.resultado(0.003);
      assert.deepEqual(vivo, pontuarEstudio(quadros, notas, 80, 0, { nivel }));
      return vivo;
    });
    for (let i = 1; i < resultados.length; i++) {
      assert.ok(resultados[i - 1].total >= resultados[i].total, `desvio ${desvio}: total`);
      assert.ok(resultados[i - 1].nota >= resultados[i].nota, `desvio ${desvio}: nota`);
    }
  }
});

test('níveis: Fácil aceita qualquer altura com voz válida nas notas curtas, silêncio e ruído não', () => {
  const notas = [{ inicio_ms: 2500, dur_ms: 100, midi: 60, golden: false, linha: 0 }];
  function rodar(nivel, midi, clareza = 0.95, volume = 0.08) {
    const motor = new PontuacaoAoVivo(notas, { nivel, latenciaMs: 0 });
    motor.adicionarQuadro(2520, midi, clareza, volume, 50);
    return motor.resultado();
  }
  assert.equal(rodar('facil', 66).total, 10000);
  assert.equal(rodar('normal', 66).total, 0);
  assert.equal(rodar('dificil', 66).total, 0);
  assert.equal(rodar('facil', null).total, 0);
  assert.equal(rodar('facil', 66, 0.4).total, 0);
  assert.equal(rodar('facil', 66, 0.95, 0.001).total, 0);
});

test('níveis: Fácil antecipa combo e preserva sequência com acerto parcial', () => {
  assert.deepEqual([2, 3, 7, 14].map((n) => multiplicadorDeCombo(n, 'facil')), [1, 2, 3, 4]);
  const notas = melodiaLonga(4);
  function rodar(nivel) {
    const motor = new PontuacaoAoVivo(notas, { nivel, latenciaMs: 0 });
    for (const n of notas) for (let dt = 0; dt < 250; dt += 50) motor.adicionarQuadro(n.inicio_ms + dt, n.midi, 0.95, 0.08, 50);
    return motor.resultado();
  }
  assert.equal(rodar('facil').resumo.maiorSequencia, 4);
  assert.equal(rodar('normal').resumo.maiorSequencia, 0);
});

test('níveis: Difícil cobra mais cobertura e respeita calibração explícita', () => {
  const notas = [{ inicio_ms: 2500, dur_ms: 1000, midi: 60, golden: false, linha: 0 }];
  function rodar(nivel, opcoes = {}) {
    const motor = new PontuacaoAoVivo(notas, { nivel, latenciaMs: 0, ...opcoes });
    for (let dt = 0; dt < 500; dt += 50) motor.adicionarQuadro(2500 + dt, 60, 0.95, 0.08, 50);
    return motor.resultado();
  }
  assert.equal(rodar('normal').total, 10000);
  assert.ok(rodar('dificil').total < rodar('normal').total);
  assert.equal(rodar('dificil', { cobertura: 0.5 }).total, 10000);
});
