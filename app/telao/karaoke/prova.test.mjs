import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const carregar = (nome) => {
  const js = ts.transpileModule(fs.readFileSync(new URL(nome, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} }; new Function('module', 'exports', js)(mod, mod.exports); return mod.exports;
};
const { classificarEliminatoria, escolherFinalistas, classificarFinal, tentativaPermitida, medirDificuldade, ocultoPadrao, rankingEscondido } = carregar('./prova.ts');
const { pontuarEstudio } = carregar('./pontuacao.ts');
const musicas = [1, 2, 3, 4, 5];
const pessoa = (id) => ({ user_id: id, nome: `Pessoa ${id}`, avatar_url: null });
const tentativa = (id, musica, nota, afinacao = 0.8, fase = 'eliminatoria') => ({ user_id: id, catalogo_id: musica, fase, nota, detalhes: { afinacao }, status: 'valida' });
test('soma das cinco notas: música faltante vale zero', () => {
  const [p] = classificarEliminatoria(musicas, [tentativa(1, 1, 80), tentativa(1, 3, 60)], [pessoa(1)]);
  assert.equal(p.soma_eliminatoria, 140); assert.deepEqual(p.notas.map((n) => n.nota), [80, 0, 60, 0, 0]); assert.equal(p.afinacao_media, 0.32);
});
test('escolhe quatro finalistas por soma, depois afinação, depois cadastro', () => {
  const t = [tentativa(1, 1, 90), tentativa(2, 1, 85), tentativa(3, 1, 80, 0.9), tentativa(4, 1, 80, 0.8), tentativa(5, 1, 80, 0.8), tentativa(6, 1, 70)];
  const ranking = classificarEliminatoria(musicas, t, [6, 5, 4, 3, 2, 1].map(pessoa));
  assert.deepEqual(escolherFinalistas(ranking).map((p) => p.user_id), [1, 2, 3, 4]);
});
test('somente músicas oficiais e pessoas participantes entram na eliminatória', () => {
  const ranking = classificarEliminatoria(musicas, [tentativa(1, 8, 100), tentativa(2, 1, 50)], [pessoa(1), pessoa(2), pessoa(3)]);
  assert.deepEqual(ranking.map((p) => p.user_id), [2]);
});
test('final desempata por soma eliminatória, afinação média e cadastro', () => {
  const eliminatoria = classificarEliminatoria(musicas, [tentativa(1, 1, 90, 0.9), tentativa(2, 1, 80, 0.95), tentativa(3, 1, 80, 0.8), tentativa(4, 1, 80, 0.8)], [4, 3, 2, 1].map(pessoa));
  const final = classificarFinal(eliminatoria, [1, 2, 3, 4].map((id) => tentativa(id, 2, 95, 0, 'final')));
  assert.deepEqual(final.map((p) => p.user_id), [1, 2, 3, 4]);
  assert.equal(classificarFinal(eliminatoria, [tentativa(4, 2, 100, 0, 'final')])[0].user_id, 4);
});
test('tentativa final em andamento não antecipa resultado', () => {
  const eliminatoria = classificarEliminatoria(musicas, [tentativa(1, 1, 50)], [pessoa(1)]);
  assert.equal(classificarFinal(eliminatoria, [{ ...tentativa(1, 2, 80, 0, 'final'), status: 'cantando' }])[0].nota_final, null);
});
test('uma tentativa por pessoa, música e fase, inclusive abandonada ou cantando', () => {
  for (const status of ['valida', 'cantando', 'abandonada']) {
    const t = [{ ...tentativa(1, 1, 0), status }];
    assert.equal(tentativaPermitida(t, 1, 1, 'eliminatoria'), false);
    assert.equal(tentativaPermitida(t, 1, 1, 'final'), true);
    assert.equal(tentativaPermitida(t, 2, 1, 'eliminatoria'), true);
    assert.equal(tentativaPermitida(t, 1, 2, 'eliminatoria'), true);
  }
});
test('dificuldade cresce com extensão, notas longas e velocidade da letra', () => {
  const base = [{ inicio_ms: 0, dur_ms: 500, midi: 60, linha: 0, golden: false }, { inicio_ms: 600, dur_ms: 500, midi: 62, linha: 0, golden: false }];
  const letra = (texto) => ({ linhas: [{ inicio_ms: 0, fim_ms: 1000, texto, palavras: [] }] });
  const a = medirDificuldade(base, letra('oi'));
  assert.ok(medirDificuldade(base.map((n, i) => ({ ...n, midi: 60 + i * 24 })), letra('oi')).indice > a.indice);
  assert.ok(medirDificuldade(base.map((n) => ({ ...n, dur_ms: 4000 })), letra('oi')).indice > a.indice);
  assert.ok(medirDificuldade(base, letra('a e i o u a e i')).indice > a.indice);
  assert.equal(medirDificuldade([], null).indice, 0);
});
test('parcial usa todas as notas, sem normalizar pela parte cantada', () => {
  const notas = [0, 1, 2, 3].map((i) => ({ inicio_ms: i * 1000, dur_ms: 900, midi: 60 + i * 2, linha: i, golden: false }));
  const quadros = Array.from({ length: 27 }, (_, i) => ({ t: i * 33, m: 140 + i * 33, hz: 440 * 2 ** ((60 - 69) / 12), clareza: .95, rms: .1 }));
  const parcial = pontuarEstudio(quadros, notas, 140, 0, { nivel: 'dificil', limiar: .008 });
  const trecho = pontuarEstudio(quadros, notas.slice(0, 1), 140, 0, { nivel: 'dificil', limiar: .008 });
  assert.ok(parcial.nota < trecho.nota); assert.ok(parcial.nota <= 25); assert.equal(parcial.resumo.notas, 4);
});

test('explicação é opcional e preserva nota e detalhes antigos do motor', () => {
  const notas = [{ inicio_ms: 0, dur_ms: 900, midi: 60, linha: 0, golden: false }];
  const comum = pontuarEstudio([], notas, 140, 0, { nivel: 'dificil' });
  const explicado = pontuarEstudio([], notas, 140, 0, { nivel: 'dificil', explicar: true });
  assert.equal(explicado.nota, comum.nota);
  assert.equal(explicado.detalhes.pontosNotas, 0);
  assert.equal(explicado.detalhes.notasAcertadas, 0);
  const { pontosNotas, notasAcertadas, ...antigos } = explicado.detalhes;
  assert.deepEqual(antigos, comum.detalhes);
});

test('tentativa anulada libera nova tentativa, não conta na eliminatória nem na final', () => {
  const anulada = { ...tentativa(1, 1, 99), status: 'anulada' };
  assert.equal(tentativaPermitida([anulada], 1, 1, 'eliminatoria'), true);
  assert.equal(tentativaPermitida([anulada, { ...tentativa(1, 1, 50), status: 'valida' }], 1, 1, 'eliminatoria'), false);
  assert.deepEqual(classificarEliminatoria(musicas, [anulada], [pessoa(1)]), []);
  const [p] = classificarEliminatoria(musicas, [anulada, { ...tentativa(1, 1, 50), status: 'valida' }], [pessoa(1)]);
  assert.equal(p.soma_eliminatoria, 50);
  const final = classificarFinal([p], [{ ...tentativa(1, 2, 100, 0, 'final'), status: 'anulada' }]);
  assert.equal(final[0].nota_final, null);
});
test('ranking escondido: padrão 24/12 22h SP menos 48h, até a revelação; admin decide fora daqui', () => {
  assert.equal(ocultoPadrao(2026).toISOString(), '2026-12-23T01:00:00.000Z');
  const antes = Date.parse('2026-12-23T00:59:59Z'); const depois = Date.parse('2026-12-23T01:00:00Z');
  assert.equal(rankingEscondido(antes, null, null, 2026), false);
  assert.equal(rankingEscondido(depois, null, null, 2026), true);
  assert.equal(rankingEscondido(depois, undefined, undefined, 2026), true);
  assert.equal(rankingEscondido(depois, new Date('2026-12-30T00:00:00Z'), null, 2026), false);
  assert.equal(rankingEscondido(depois, new Date('2026-12-01T00:00:00Z'), null, 2026), true);
  assert.equal(rankingEscondido(depois, '2026-12-01T00:00:00Z', new Date('2026-12-24T23:00:00Z'), 2026), false);
});
