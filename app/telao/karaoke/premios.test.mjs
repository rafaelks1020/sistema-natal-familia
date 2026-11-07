import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const js = ts.transpileModule(fs.readFileSync(new URL('./premios.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const { selecionarPremios, montarPlacar } = mod.exports;
const a = (id, user_id, nota, extras = {}) => ({ id, user_id, nome: `Pessoa ${user_id}`, musica_id: 'video:abc', titulo: 'Música da família', nota, iniciado_em: `2026-12-24T${String(20 + Math.floor(id / 60)).padStart(2, '0')}:${String(id % 60).padStart(2, '0')}:00Z`, ...extras });
const premio = (feitas, id) => selecionarPremios(feitas).find((p) => p.id === id);

test('noite vazia não inventa pessoas, músicas nem prêmios', () => {
  assert.deepEqual(montarPlacar([], 2026), { ano: 2026, ranking: [], facil: [], musicas: [], apresentacoes: [], premios: [] });
});

test('ranking usa melhor nota, média e contagem, incluindo dueto sem duplicar música', () => {
  const r = montarPlacar([a(1, 1, 70), a(2, 1, 90, { dueto_user_id: 2, dueto_nome: 'Dueto' }), a(3, 3, 90)], 2026);
  assert.deepEqual(r.ranking.map((p) => [p.user_id, p.melhor, p.media, p.cantadas]), [[2, 90, 90, 1], [3, 90, 90, 1], [1, 90, 80, 2]]);
  assert.equal(r.musicas.length, 1);
  assert.equal(r.musicas[0].melhor, 90);
  assert.equal(r.musicas[0].cantadas, 3);
  assert.equal(r.musicas[0].dueto_nome, 'Dueto');
});

test('prêmios respeitam os maiores valores e omitem combo ausente', () => {
  const feitas = [a(1, 1, 98), a(2, 2, 40), a(3, 2, 65), a(4, 3, 50), a(5, 3, 95), a(6, 2, 66)];
  assert.equal(premio(feitas, 'voz').user_id, 1);
  assert.equal(premio(feitas, 'animado').user_id, 2);
  assert.equal(premio(feitas, 'corajoso').user_id, 1);
  assert.equal(premio(feitas, 'revelacao').user_id, 3);
  assert.equal(premio(feitas, 'combo'), undefined);
});

test('distribui empates globalmente para não repetir quando existe alternativa', () => {
  const feitas = [a(1, 1, 90), a(2, 2, 90), a(3, 3, 80)];
  const premios = selecionarPremios(feitas);
  assert.equal(new Set(premios.map((p) => p.user_id)).size, 3);
  assert.equal(premio(feitas, 'corajoso').user_id, 1);
});

test('poucas pessoas podem receber mais de um prêmio sem inventar revelação', () => {
  const feitas = [a(1, 1, 0)];
  assert.equal(selecionarPremios(feitas).length, 3);
  assert.ok(selecionarPremios(feitas).every((p) => p.user_id === 1));
  assert.equal(premio(feitas, 'revelacao'), undefined);
});

test('coragem prefere maior dificuldade quando informada e combo lê o campo gravado', () => {
  const feitas = [a(1, 1, 80, { detalhes: { maiorCombo: 2, dificuldade: 1 } }), a(2, 2, 70, { detalhes: { maiorCombo: 4, dificuldade: 9 } })];
  assert.equal(premio(feitas, 'corajoso').user_id, 2);
  assert.equal(premio(feitas, 'combo').user_id, 2);
  assert.equal(premio(feitas, 'combo').valor, 4);
});

test('primeira apresentação usa horário de início e revelação usa primeira nota cronológica', () => {
  const feitas = [a(1, 1, 90, { iniciado_em: '2026-12-24T22:00:00Z' }), a(2, 1, 30, { iniciado_em: '2026-12-24T20:00:00Z' }), a(3, 2, 95)];
  assert.equal(premio(feitas, 'corajoso').user_id, 1);
  assert.equal(premio(feitas, 'revelacao').valor, 60);
});

test('não altera entrada, ignora notas inválidas e apresentação duplicada', () => {
  const feitas = [a(3, 3, NaN), a(2, 2, 100), a(1, 1, -1), a(2, 2, 100), a(4, 4, Infinity), a(5, 5, 101)];
  const antes = structuredClone(feitas);
  const r = montarPlacar(feitas, 2026);
  assert.deepEqual(feitas, antes);
  assert.equal(r.apresentacoes.length, 1);
  assert.equal(r.ranking[0].cantadas, 1);
});

test('desempates e horários ausentes são determinísticos, sem dueto consigo mesmo', () => {
  const feitas = [a(2, 2, 80, { iniciado_em: null }), a(1, 1, 80, { iniciado_em: null, dueto_user_id: 1 })];
  assert.deepEqual(montarPlacar(feitas, 2026), montarPlacar([...feitas].reverse(), 2026));
  assert.equal(montarPlacar(feitas, 2026).ranking[0].cantadas, 1);
});

test('dueto concorre em todos os prêmios e músicas distintas mantêm seus melhores', () => {
  const feitas = [a(1, 1, 60, { dueto_user_id: 2, dueto_nome: 'Parceira' }), a(2, 1, 95, { musica_id: 'catalogo:2', dueto_user_id: 2, dueto_nome: 'Parceira', detalhes: { maiorCombo: 4 } })];
  const r = montarPlacar(feitas, 2026);
  assert.equal(r.musicas.length, 2);
  assert.equal(new Set(r.premios.map((p) => p.user_id)).size, 2);
  assert.ok(r.ranking.every((p) => p.cantadas === 2 && p.melhor === 95));
  assert.equal(premio(feitas, 'revelacao').valor, 35);
});

test('nível: ranking e Voz de anjo usam só Normal e Difícil; o Fácil vai para a linha separada', () => {
  const feitas = [
    a(1, 1, 99, { detalhes: { nivel: 'facil' } }),
    a(2, 2, 80, { detalhes: { nivel: 'normal' } }),
    a(3, 3, 70, { detalhes: { nivel: 'dificil' } }),
    a(4, 1, 60, { detalhes: { nivel: 'normal' } }),
    a(5, 4, 95, { detalhes: { nivel: 'facil' } }),
  ];
  const r = montarPlacar(feitas, 2026);
  assert.deepEqual(r.ranking.map((p) => [p.user_id, p.melhor, p.nivel]), [[2, 80, 'normal'], [3, 70, 'dificil'], [1, 60, 'normal']]);
  assert.deepEqual(r.facil.map((p) => [p.user_id, p.melhor, p.nivel]), [[1, 99, 'facil'], [4, 95, 'facil']]);
  const voz = premio(feitas, 'voz');
  assert.equal(voz.user_id, 2);
  assert.equal(voz.valor, 80);
  assert.match(voz.motivo, /Normal/);
});

test('nível: notas sem nível valem no ranking principal e noite só de Fácil não fica vazia', () => {
  const antigas = montarPlacar([a(1, 1, 50), a(2, 2, 90, { detalhes: { nivel: 'facil' } })], 2026);
  assert.deepEqual(antigas.ranking.map((p) => [p.user_id, p.nivel]), [[1, null]]);
  assert.deepEqual(antigas.facil.map((p) => p.user_id), [2]);
  const soFacil = montarPlacar([a(1, 1, 50, { detalhes: { nivel: 'facil' } }), a(2, 2, 90, { detalhes: { nivel: 'facil' } })], 2026);
  assert.deepEqual(soFacil.ranking.map((p) => [p.user_id, p.nivel]), [[2, 'facil'], [1, 'facil']]);
  assert.deepEqual(soFacil.facil, []);
  assert.equal(premio([a(1, 1, 50, { detalhes: { nivel: 'facil' } })], 'voz').user_id, 1);
});
