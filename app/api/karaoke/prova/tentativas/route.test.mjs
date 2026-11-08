import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

// Banco e sessão inteiramente simulados. Nenhuma variável de ambiente é carregada.
const compilar = (arquivo, dependencias = {}) => {
  const js = ts.transpileModule(fs.readFileSync(new URL(arquivo, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const m = { exports: {} };
  new Function('require', 'module', 'exports', js)((id) => {
    if (!(id in dependencias)) throw new Error(`Dependência não simulada: ${id}`);
    return dependencias[id];
  }, m, m.exports);
  return m.exports;
};
const motor = compilar('../../../../telao/karaoke/pontuacao.ts');
const regras = compilar('../../../../telao/karaoke/prova.ts');
const seguranca = compilar('../../../../telao/karaoke/prova-seguranca.ts');
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const notas = [0, 1, 2, 3].map((i) => ({ inicio_ms: i * 1000, dur_ms: 900, midi: 60 + 2 * i, linha: i, golden: false }));
function ambiente({ admin = false, fase = 'eliminatoria', repetidas = [], emCurso = false, controlador = 1, status = 'cantando' } = {}) {
  const chamadas = [];
  const config = { ano: 2026, status: fase, musicas: [10, 20, 30, 40, 50], final_musica: fase === 'final' ? 10 : null, eliminatoria_ate: new Date(Date.now() + 100000).toISOString(), final_em: new Date(Date.now() - 100000).toISOString() };
  const vazio = motor.pontuarEstudio([], notas, 140, 0, { nivel: 'dificil', limiar: .008, explicar: true });
  const tentativa = { id: '1', fila_id: '100', fase, controlador_id: controlador, status, fila_status: 'cantando', iniciada_em: new Date(Date.now() - 10000), nota: 0, detalhes: { ...vazio.detalhes, resumo: vazio.resumo, linhas: vazio.linhas, _quadros: [] }, notas, duracao_ms: 4000 };
  const finais = [{ user_id: 1 }, { user_id: 2 }];
  const q = async (sql, params = []) => {
    chamadas.push({ sql, params });
    if (sql.includes('SELECT id FROM karaoke_prova_tentativas')) return { rows: emCurso ? [{ id: 999 }] : [] };
    if (sql.includes('SELECT id FROM family_users')) return { rows: [{ id: params[0] }] };
    if (sql.includes('SELECT faixa,artista')) return { rows: [{ faixa: 'Teste', artista: 'Família', duracao_ms: 4000, capa_url: null, notas }] };
    if (sql.includes('INSERT INTO karaoke_fila')) return { rows: [{ id: '100' }] };
    if (sql.includes('INSERT INTO karaoke_prova_tentativas')) return { rows: [{ id: '1' }] };
    if (sql.includes('SELECT t.*,c.notas')) return { rows: [tentativa] };
    if (sql.includes('UPDATE karaoke_prova_tentativas SET nota')) { tentativa.nota = params[1]; tentativa.detalhes = JSON.parse(params[2]); return { rows: [] }; }
    if (sql.includes('UPDATE karaoke_fila SET parcial')) return { rows: [] };
    throw new Error(`SQL não simulado: ${sql}`);
  };
  const { POST } = compilar('./route.ts', {
    '@/app/lib/api': { route: (h) => h, ok: (v) => v, requireUser: async () => ({ id: 1, is_admin: admin }), readJson: (r) => r.json(), HttpError, toInt: (n) => { if (!Number.isInteger(Number(n)) || Number(n) <= 0) throw new HttpError(400, 'Inválido'); return Number(n); } },
    '@/app/lib/db': { transaction: (fn) => fn(q) },
    '@/app/lib/edicao': { edicaoAtual: () => 2026 },
    '@/app/telao/karaoke/prova': regras,
    '@/app/telao/karaoke/pontuacao': motor,
    '@/app/telao/karaoke/prova-seguranca': seguranca,
    '../_dados': { travar: async () => {}, recuperarInterrompidas: async () => {}, configProva: async () => config, carregarTentativas: async () => repetidas, classificacaoProva: async () => ({ finalistas: finais }), comMigracao: (h) => h, detalhesPublicos: (d) => { const { suspeita, anulacao, ...r } = d ?? {}; return r; }, semCache: (v) => v, encerrarTentativa: async (_q, _id, abandonada) => { tentativa.status = abandonada ? 'abandonada' : 'valida'; delete tentativa.detalhes._quadros; } },
  });
  return { enviar: (body) => POST({ json: async () => body }), chamadas, tentativa, config };
}
test('início por familiar usa a própria sessão e cria fila e tentativa somente no início', async () => {
  const a = ambiente();
  const r = await a.enviar({ acao: 'iniciar', user_id: 99, catalogo_id: 10 });
  assert.equal(r.id, 1); assert.equal(r.fila_id, 100);
  const fila = a.chamadas.find((c) => c.sql.includes('INSERT INTO karaoke_fila'));
  assert.equal(fila.params[1], 1);
  assert.equal(a.chamadas.filter((c) => c.sql.includes('INSERT INTO')).length, 2);
});
test('tentativa repetida recusada para todos os estados', async () => {
  for (const status of ['cantando','valida','abandonada']) {
    const a = ambiente({ repetidas: [{ user_id: 1, catalogo_id: 10, fase: 'eliminatoria', status }] });
    await assert.rejects(a.enviar({ acao: 'iniciar', catalogo_id: 10 }), (e) => e.status === 409 && /segunda chance/.test(e.message));
    assert.ok(!a.chamadas.some((c) => c.sql.includes('INSERT INTO')));
  }
});
test('eliminatória vencida e música fora da lista são recusadas', async () => {
  const a = ambiente();
  await assert.rejects(a.enviar({ acao: 'iniciar', catalogo_id: 99 }), (e) => e.status === 400);
  a.config.eliminatoria_ate = new Date(Date.now() - 1).toISOString();
  await assert.rejects(a.enviar({ acao: 'iniciar', catalogo_id: 10 }), (e) => e.status === 409);
});
test('não inicia sobre outra apresentação', async () => {
  const a = ambiente({ emCurso: true });
  await assert.rejects(a.enviar({ acao: 'iniciar', catalogo_id: 10 }), (e) => e.status === 409);
});
test('final exige organizador, música sorteada e sequência dos finalistas', async () => {
  await assert.rejects(ambiente({ fase: 'final' }).enviar({ acao: 'iniciar', catalogo_id: 10 }), (e) => e.status === 403);
  const a = ambiente({ admin: true, fase: 'final' });
  await assert.rejects(a.enviar({ acao: 'iniciar', catalogo_id: 20 }), (e) => e.status === 409);
  await assert.rejects(a.enviar({ acao: 'iniciar', catalogo_id: 10, user_id: 2 }), (e) => e.status === 409);
  assert.equal((await a.enviar({ acao: 'iniciar', catalogo_id: 10, user_id: 1 })).fase, 'final');
});
test('parcial é calculado no servidor, ignora nota enviada e deduplica lotes', async () => {
  const a = ambiente();
  const quadros = Array.from({ length: 27 }, (_, i) => ({ t: i * 33, m: 140 + i * 33, hz: 440 * 2 ** ((60 - 69) / 12), clareza: .95, rms: .1 }));
  const r = await a.enviar({ acao: 'parcial', id: 1, quadros, nota: 100 });
  assert.ok(r.resultado.nota <= 25); assert.equal(r.resultado.resumo.notas, 4); assert.equal(r.resultado.detalhes.nivel, undefined);
  await a.enviar({ acao: 'parcial', id: 1, quadros });
  assert.equal(a.tentativa.detalhes._quadros.length, 27);
  assert.equal(a.tentativa.detalhes.prova, true); assert.equal(a.tentativa.detalhes.nivel, 'dificil');
});
test('fim antecipado vira abandono e reenvio não altera a nota', async () => {
  const a = ambiente();
  const r = await a.enviar({ acao: 'terminar', id: 1, quadros: [] });
  assert.equal(r.status, 'abandonada'); assert.equal(r.resultado.nota, 0);
  const repetida = await a.enviar({ acao: 'terminar', id: 1, quadros: [] });
  assert.equal(repetida.status, 'abandonada'); assert.equal(repetida.resultado.nota, 0);
});
test('outro usuário não altera tentativa; medição inválida é descartada sem derrubar a requisição', async () => {
  await assert.rejects(ambiente({ controlador: 2 }).enviar({ acao: 'parcial', id: 1, quadros: [] }), (e) => e.status === 403);
  const r = await ambiente().enviar({ acao: 'parcial', id: 1, quadros: [{ t: 0, m: 0, hz: NaN, clareza: .9, rms: .1 }] });
  assert.equal(r.descartados, 1); assert.equal(r.status, 'cantando');
});

test('interrupção pelo controle da fila também registra abandono', async () => {
  const a = ambiente();
  a.tentativa.fila_status = 'pulada';
  const r = await a.enviar({ acao: 'parcial', id: 1, quadros: [] });
  assert.equal(r.status, 'abandonada');
  assert.equal(a.tentativa.status, 'abandonada');
});

const quadroOk = (i) => ({ t: i * 33, m: 140 + i * 33, hz: 440 * 2 ** ((60 - 69) / 12), clareza: .95, rms: .1 });
test('quadro inválido no lote é descartado, o resto é gravado e ultimo_t volta para o cliente retomar', async () => {
  const a = ambiente();
  const r = await a.enviar({ acao: 'parcial', id: 1, quadros: [quadroOk(0), { t: 33, m: 173, hz: NaN, clareza: .9, rms: .1 }, quadroOk(2), { ...quadroOk(3), clareza: 7 }] });
  assert.equal(r.status, 'cantando'); assert.equal(a.tentativa.detalhes._quadros.length, 2);
  assert.equal(r.ultimo_t, 66); assert.equal(r.descartados, 2); assert.equal(r.lote_ate_t, 99);
});
test('salto de posição impossível continua sendo 400', async () => {
  const a = ambiente();
  await assert.rejects(a.enviar({ acao: 'parcial', id: 1, quadros: [{ ...quadroOk(0), m: 3000 }, { ...quadroOk(1), m: 500 }] }), (e) => e.status === 400 && /pular ou recomeçar/.test(e.message));
});
test('final por familiar é recusada logo no início (403), antes de qualquer outra regra', async () => {
  const a = ambiente({ fase: 'final', repetidas: [{ user_id: 1, catalogo_id: 10, fase: 'final', status: 'valida' }] });
  await assert.rejects(a.enviar({ acao: 'iniciar', catalogo_id: 10 }), (e) => e.status === 403);
  assert.ok(!a.chamadas.some((c) => c.sql.includes('INSERT INTO')));
});
test('início convive com a fila livre cantando: só outra tentativa oficial em andamento bloqueia', async () => {
  const a = ambiente();
  await a.enviar({ acao: 'iniciar', catalogo_id: 10 });
  const ocupada = a.chamadas.find((c) => c.sql.includes('SELECT id FROM karaoke_prova_tentativas'));
  assert.ok(ocupada); assert.ok(!a.chamadas.some((c) => c.sql.includes('SELECT id FROM karaoke_fila')));
});
test('tentativa anulada anterior não bloqueia nova tentativa', async () => {
  const a = ambiente({ repetidas: [{ user_id: 1, catalogo_id: 10, fase: 'eliminatoria', status: 'anulada' }] });
  assert.equal((await a.enviar({ acao: 'iniciar', catalogo_id: 10 })).id, 1);
});
test('resposta idempotente de tentativa encerrada não vaza suspeita para familiar', async () => {
  const a = ambiente({ status: 'valida' });
  a.tentativa.detalhes.suspeita = ['Nota 99'];
  const r = await a.enviar({ acao: 'terminar', id: 1, quadros: [] });
  assert.equal(r.resultado.detalhes.suspeita, undefined);
  const adm = ambiente({ status: 'valida', admin: true }); adm.tentativa.detalhes.suspeita = ['Nota 99'];
  assert.deepEqual((await adm.enviar({ acao: 'terminar', id: 1, quadros: [] })).resultado.detalhes.suspeita, ['Nota 99']);
});
