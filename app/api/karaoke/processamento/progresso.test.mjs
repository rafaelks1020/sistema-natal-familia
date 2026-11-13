import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const js = ts.transpileModule(fs.readFileSync(new URL('./progresso.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const { estimarProcessamento } = mod.exports;
const agora = Date.parse('2026-11-07T18:00:00Z');
const linha = (id, campos = {}) => ({
  id: String(id), slug: `musica-${id}`, artista: 'Família', faixa: `Música ${id}`,
  status: 'na_fila', etapa: 'na_fila', progresso: 0, pedido_por: 2,
  created_at: new Date(agora - 60_000).toISOString(), etapa_em: new Date(agora).toISOString(), ...campos,
});

test('fila usa created_at e id e acumula 15 minutos por pedido sem histórico', () => {
  const r = estimarProcessamento([linha(3), linha(2), linha(1, { created_at: new Date(agora).toISOString() })], {}, 2, agora);
  assert.deepEqual(r.map((m) => [m.id, m.posicao_fila, m.minutos_estimados]), [[3, 2, 30], [2, 1, 15], [1, 3, 45]]);
  assert.equal(r[0].meu_pedido, true);
});

test('tempo restante da etapa usa histórico e inclui a música em processamento antes da fila', () => {
  const r = estimarProcessamento([
    linha(1, { status: 'processando', etapa: 'alinhando_letra', progresso: 45, etapa_em: new Date(agora - 60_000) }),
    linha(2),
  ], { baixando: 60, separando_voz: 120, alinhando_letra: 120, gerando_notas: 120, publicando: 60 }, 3, agora);
  assert.deepEqual(r.map((m) => [m.posicao_fila, m.minutos_estimados, m.progresso]), [[0, 4, 57], [1, 12, 0]]);
  assert.equal(r[0].meu_pedido, false);
});

test('fase acima da média não anuncia pronta, nem chega a 100%', () => {
  const [r] = estimarProcessamento([linha(1, { status: 'processando', etapa: 'publicando', progresso: 95, etapa_em: new Date(agora - 3600_000) })], {}, 2, agora);
  assert.equal(r.progresso, 99);
  assert.equal(r.minutos_estimados, 1);
  assert.equal(r.status, 'processando');
});

test('pronta e falhou não ocupam a fila nem alteram a previsão de quem espera', () => {
  const r = estimarProcessamento([
    linha(1, { status: 'pronta', etapa: 'publicando', progresso: 95 }),
    linha(2, { status: 'falhou', etapa: 'gerando_notas', progresso: 70 }), linha(3),
  ], {}, 2, agora);
  assert.deepEqual(r.map((m) => [m.etapa, m.posicao_fila, m.minutos_estimados, m.progresso]), [
    ['pronta', null, 0, 100], ['falhou', null, null, 70], ['na_fila', 1, 15, 0],
  ]);
});

test('histórico inválido usa a referência e relógio adiantado não gera progresso negativo', () => {
  const [r] = estimarProcessamento([linha(1, { status: 'baixando', etapa: 'baixando', progresso: 5, etapa_em: new Date(agora + 60_000) })], { baixando: NaN, separando_voz: -1, publicando: 0 }, 2, agora);
  assert.equal(r.minutos_estimados, 15);
  assert.equal(r.progresso, 5);
});

test('etapa parada há mais de 6 horas vira falha, avisa e não segura a fila', () => {
  const preso = 6 * 60 * 60 * 1000;
  const r = estimarProcessamento([
    linha(1, { status: 'baixando', etapa: 'baixando', progresso: 5, etapa_em: new Date(agora - preso - 1).toISOString() }),
    linha(2, { status: 'processando', etapa: 'alinhando_letra', progresso: 40, etapa_em: new Date(agora - preso - 1).toISOString() }),
    linha(3),
  ], {}, 9, agora);
  assert.equal(r[0].status, 'falhou');
  assert.equal(r[0].etapa, 'falhou');
  assert.equal(r[0].posicao_fila, null);
  assert.equal(r[0].minutos_estimados, null);
  assert.match(r[0].erro, /mais de 6 horas/);
  assert.equal(r[1].status, 'falhou');
  assert.equal(r[1].erro, r[0].erro);
  assert.equal(r[2].status, 'na_fila');
  assert.equal(r[2].posicao_fila, 1);
  assert.equal(r[2].minutos_estimados, 15);
  assert.equal(r[2].erro, null);
  const noLimite = estimarProcessamento([
    linha(1, { status: 'processando', etapa: 'publicando', progresso: 95, etapa_em: new Date(agora - preso).toISOString() }),
  ], {}, 2, agora);
  assert.equal(noLimite[0].status, 'processando');
  assert.equal(noLimite[0].erro, null);
});

test('registro do worker anterior ganha previsão compatível pelo status', () => {
  const [r] = estimarProcessamento([linha(1, { status: 'processando', etapa: 'na_fila', progresso: 0 })], {}, 2, agora);
  assert.equal(r.minutos_estimados, 13);
  assert.equal(r.posicao_fila, 0);
  assert.equal(r.etapa, 'separando_voz');
});
