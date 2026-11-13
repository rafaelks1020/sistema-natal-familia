import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

// Banco e sessão simulados: só confere o SQL e os parâmetros que a fila livre e o placar mandam.
const compilar = (arquivo, dependencias = {}) => {
  const js = ts.transpileModule(fs.readFileSync(new URL(arquivo, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const m = { exports: {} };
  new Function('require', 'module', 'exports', js)((id) => {
    if (!(id in dependencias)) throw new Error(`Dependência não simulada: ${id}`);
    return dependencias[id];
  }, m, m.exports);
  return m.exports;
};
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const prova = compilar('../../../telao/karaoke/prova.ts');
const oculto = (query) => compilar('../_oculto.ts', { '@/app/telao/karaoke/prova': prova, '@/app/lib/db': { query } });
const toInt = (n) => Number(n);

function ambienteFila({ admin = false, gami = [], presos = [], batalhaRemovida = null } = {}) {
  const chamadas = [];
  const q = async (sql, params = []) => {
    chamadas.push({ sql, params });
    if (sql.includes('FROM gami_config')) return { rows: gami };
    if (sql.includes('SELECT id, parcial, modo FROM karaoke_fila') && sql.includes("status = 'cantando'")) return { rows: presos };
    if (sql.includes("SELECT id FROM karaoke_fila WHERE ano = $1 AND status = 'cantando'")) return { rows: [{ id: 5 }] };
    if (sql.includes('SELECT status FROM karaoke_fila')) return { rows: [{ status: 'fila' }] };
    if (sql.includes('SELECT batalha_id, batalha_rodada')) return { rows: [{ batalha_id: null, batalha_rodada: null }] };
    if (sql.includes('RETURNING user_id')) return { rows: [{ user_id: 1, dueto_user_id: null }] };
    if (sql.includes('DELETE FROM karaoke_fila')) return { rows: [{ batalha_id: batalhaRemovida }] };
    if (sql.includes('RETURNING batalha_id')) return { rows: [{ batalha_id: null }] };
    return { rows: sql.includes('FROM karaoke_fila WHERE ano = $1 AND status IN') ? [{ id: 7, user_id: 1, status: 'fila' }] : [] };
  };
  const query = q; query.__q = q;
  const mod = compilar('./route.ts', {
    '@/app/lib/api': { route: (h) => h, ok: (v) => v, readJson: (r) => r.json(), cleanText: (v) => String(v), toInt, HttpError, requireUser: async () => ({ id: 1, is_admin: admin }), requireAdmin: async () => ({ id: 1, is_admin: true }) },
    '@/app/lib/db': { query, transaction: (fn) => fn(q) },
    '@/app/lib/edicao': { edicaoAtual: () => 2026 },
    '@/app/lib/limite': { dentroDoLimite: () => true },
    '@/app/telao/karaoke/fila-justa': compilar('../../../telao/karaoke/fila-justa.ts'),
    '@/app/telao/karaoke/batalha': compilar('../../../telao/karaoke/batalha.ts', { './tipos': {} }),
    '@/app/telao/karaoke/pontuacao': compilar('../../../telao/karaoke/pontuacao.ts'),
    '../_lrclib': {}, '../_youtube': {}, '../_trocar': {},
    '../_oculto': oculto(query),
  });
  return { ...mod, chamadas };
}
const gamiAntiga = [{ ranking_oculto_em: new Date('2020-12-22T22:00:00-03:00'), revelado_em: null }];

test('GET da família no período oculto: pede notas e parcial da Prova mascarados e ranking sem a Prova', async () => {
  const a = ambienteFila({ gami: gamiAntiga });
  await a.GET({ url: 'http://x/api/karaoke/fila' });
  const linhas = a.chamadas.find((c) => c.sql.includes('LEFT JOIN karaoke_prova_tentativas'));
  const ranking = a.chamadas.find((c) => c.sql.includes('GROUP BY u.id'));
  assert.equal(linhas.params[2], true); assert.match(linhas.sql, /\$3::boolean AND pt\.id IS NOT NULL THEN NULL ELSE n\.nota/); assert.match(linhas.sql, /ELSE f\.parcial END/);
  assert.match(linhas.sql, /pt\.status <> 'cantando'/);
  assert.equal(ranking.params[1], true); assert.match(ranking.sql, /NOT \(\$2::boolean AND EXISTS \(SELECT 1 FROM karaoke_prova_tentativas/);
});
test('GET do admin, ou antes do período oculto, ou depois da revelação: nada é mascarado', async () => {
  for (const [admin, gami] of [[true, gamiAntiga], [false, [{ ranking_oculto_em: new Date(Date.now() + 1e9), revelado_em: null }]], [false, [{ ranking_oculto_em: new Date(2020, 1, 1), revelado_em: new Date() }]]]) {
    const a = ambienteFila({ admin, gami });
    await a.GET({ url: 'http://x/api/karaoke/fila' });
    const linhas = a.chamadas.find((c) => c.sql.includes('LEFT JOIN karaoke_prova_tentativas'));
    assert.equal(linhas.params[2], false);
  }
});
test('sem linha em gami_config vale o padrão (24/12 22h SP menos 48h)', async () => {
  const q = async () => ({ rows: [] });
  const agora = Date.now(); const padrao = +prova.ocultoPadrao(new Date(agora).getFullYear());
  assert.equal(await oculto(q).ocultarNotasDaProva(q, new Date(agora).getFullYear(), false), agora >= padrao);
});
test('comecar sem id, terminar sem id, pular e terminar com id nunca tocam em tentativa da Prova em andamento', async () => {
  const guarda = /NOT EXISTS \(SELECT 1 FROM karaoke_prova_tentativas pt WHERE pt\.fila_id = karaoke_fila\.id AND pt\.status = 'cantando'\)/;
  const a = ambienteFila({ admin: true });
  const patch = (body) => a.PATCH({ json: async () => body });
  await patch({ acao: 'comecar' });
  assert.match(a.chamadas.find((c) => c.sql.includes("SET status = 'pulada', terminado_em = NOW() WHERE ano = $1 AND status = 'cantando'")).sql, guarda);
  assert.match(a.chamadas.find((c) => c.sql.includes('parcial IS NULL')).sql, /parcial IS NULL/);
  assert.equal(a.chamadas.some((c) => c.sql.includes('INSERT INTO karaoke_notas')), false);
  assert.match(a.chamadas.find((c) => c.sql.includes('SELECT id, user_id, dueto_user_id, status') || c.sql.includes('SELECT id, user_id, dueto_user_id')).sql, guarda);
  a.chamadas.length = 0;
  await patch({ acao: 'terminar' });
  assert.match(a.chamadas.find((c) => c.sql.includes("SELECT id FROM karaoke_fila WHERE ano = $1 AND status = 'cantando'")).sql, guarda);
  assert.match(a.chamadas.find((c) => c.sql.includes("SET status = 'feita'")).sql, guarda);
  a.chamadas.length = 0;
  await patch({ acao: 'pular', id: 5 });
  assert.match(a.chamadas.find((c) => c.sql.includes("SET status = 'pulada'")).sql, guarda);
  a.chamadas.length = 0;
  await patch({ acao: 'parcial', id: 5, pontos: 10 });
  assert.match(a.chamadas.find((c) => c.sql.includes('SET parcial')).sql, guarda);
});
test('remover não apaga apresentação ligada à Prova', async () => {
  const a = ambienteFila({ admin: true });
  await a.PATCH({ json: async () => ({ acao: 'remover', id: 5 }) }).catch(() => undefined);
  const del = a.chamadas.find((c) => c.sql.includes('DELETE FROM karaoke_fila'));
  assert.match(del.sql, /NOT EXISTS \(SELECT 1 FROM karaoke_prova_tentativas/);
  assert.doesNotMatch(del.sql, /user_id = \$3/);
});

test('comecar grava a nota do parcial e só pula quem não tem placar', async () => {
  const a = ambienteFila({ admin: true, presos: [{ id: 9, parcial: 4230, modo: 'estudio' }, { id: 11, parcial: null, modo: 'video' }] });
  await a.PATCH({ json: async () => ({ acao: 'comecar' }) });
  const feitas = a.chamadas.filter((c) => c.sql.includes("SET status = 'feita'"));
  assert.equal(feitas.length, 1);
  assert.equal(feitas[0].params[0], 9);
  assert.match(feitas[0].sql, /NOT EXISTS \(SELECT 1 FROM karaoke_prova_tentativas pt WHERE pt\.fila_id = karaoke_fila\.id AND pt\.status = 'cantando'\)/);
  const notas = a.chamadas.filter((c) => c.sql.includes('INSERT INTO karaoke_notas'));
  assert.equal(notas.length, 1);
  assert.deepEqual(notas[0].params, [9, 42, 2, null]);
  const pulada = a.chamadas.find((c) => c.sql.includes("SET status = 'pulada'"));
  assert.match(pulada.sql, /parcial IS NULL/);
  assert.match(pulada.sql, /pt\.status = 'cantando'/);
});

test('quem não organiza não mexe na fila, mas remove o próprio pedido que ainda espera', async () => {
  const negado = ambienteFila({ admin: false });
  await assert.rejects(() => negado.PATCH({ json: async () => ({ acao: 'comecar' }) }), (e) => e.status === 403);
  await assert.rejects(() => negado.PATCH({ json: async () => ({ acao: 'pular', id: 5 }) }), (e) => e.status === 403);
  const a = ambienteFila({ admin: false, batalhaRemovida: '11111111-1111-1111-1111-111111111111' });
  await a.PATCH({ json: async () => ({ acao: 'remover', id: 5 }) });
  const del = a.chamadas.find((c) => c.sql.includes('DELETE FROM karaoke_fila'));
  assert.match(del.sql, /user_id = \$3/);
  assert.match(del.sql, /status = 'fila'/);
  assert.match(del.sql, /NOT EXISTS \(SELECT 1 FROM karaoke_prova_tentativas/);
  assert.deepEqual(del.params, [5, 2026, 1]);
  const parceiro = a.chamadas.find((c) => c.sql.includes('id <> $3') && c.sql.includes("status = 'fila'"));
  assert.match(parceiro.sql, /NOT EXISTS \(SELECT 1 FROM karaoke_prova_tentativas/);
  assert.doesNotMatch(parceiro.sql, /cantando/);
  assert.deepEqual(parceiro.params, ['11111111-1111-1111-1111-111111111111', 2026, 5]);
});

test('placar da família no período oculto exclui as apresentações da Prova; admin vê tudo', async () => {
  for (const [admin, esperado] of [[false, true], [true, false]]) {
    const chamadas = [];
    const q = async (sql, params = []) => { chamadas.push({ sql, params }); return { rows: sql.includes('gami_config') ? gamiAntiga : [] }; };
    const { GET } = compilar('../placar/route.ts', {
      '@/app/lib/api': { route: (h) => h, ok: (v) => ({ ...v, headers: new Headers() }), requireUser: async () => ({ id: 1, is_admin: admin }) },
      '@/app/lib/db': { query: q }, '@/app/lib/edicao': { edicaoAtual: () => 2026 },
      '../_oculto': oculto(q), '@/app/telao/karaoke/premios': { montarPlacar: () => ({}) },
    });
    await GET();
    const placar = chamadas.find((c) => c.sql.includes('JOIN karaoke_notas'));
    assert.equal(placar.params[1], esperado); assert.match(placar.sql, /NOT \(\$2::boolean AND EXISTS \(SELECT 1 FROM karaoke_prova_tentativas/);
  }
});
