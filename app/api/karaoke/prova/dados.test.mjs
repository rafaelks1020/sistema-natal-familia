import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const compilar = (nome, dependencias = {}) => {
  const js = ts.transpileModule(fs.readFileSync(new URL(nome, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const m = { exports: {} }; new Function('require', 'module', 'exports', js)((id) => {
    if (!(id in dependencias)) throw new Error(`Dependência não simulada: ${id}`);
    return dependencias[id];
  }, m, m.exports); return m.exports;
};
const regras = compilar('../../../telao/karaoke/prova.ts');
const motor = compilar('../../../telao/karaoke/pontuacao.ts');
const seguranca = compilar('../../../telao/karaoke/prova-seguranca.ts');
let transacaoChamada = 0;
const dados = compilar('./_dados.ts', {
  '@/app/lib/api': { HttpError: Error },
  '@/app/lib/db': { transaction: async (fn) => { transacaoChamada++; return fn(async (sql) => ({ rows: sql.includes("INTERVAL '45 seconds'") ? [{ id: '9' }] : [] })); } },
  '@/app/telao/karaoke/prova-seguranca': seguranca,
  '@/app/lib/edicao': { edicaoAtual: () => 2026 },
  '@/app/telao/karaoke/prova': regras,
  '@/app/telao/karaoke/pontuacao': motor,
});
const usuario = { id: 1, is_admin: false };
test('ausência de configuração geral usa 24/12 22h SP menos 48h', async () => {
  const q = async (sql) => {
    assert.ok(/karaoke_prova|gami_config|karaoke_catalogo/.test(sql));
    return { rows: [] };
  };
  const p = await dados.painelProva(q, usuario);
  assert.equal(p.ranking_oculto_em, '2026-12-23T01:00:00.000Z');
});
test('ranking após a ocultação não expõe classificação nem resultado final para familiar', async () => {
  const q = async (sql) => ({ rows: sql.includes('FROM gami_config') ? [{ ranking_oculto_em: new Date('2020-12-22T22:00:00-03:00'), revelado_em: null }] : [] });
  const p = await dados.painelProva(q, usuario);
  assert.equal(p.classificacao, null); assert.equal(p.finalistas, null); assert.equal(p.resultado_final, null);
});
const notasMusica = [{ inicio_ms: 0, dur_ms: 900, midi: 60, linha: 0, golden: false }];
test('encerramento grava nota inclusive zero, metadados oficiais e fila feita', async () => {
  for (const nota of [null, 70]) {
    const chamadas = [];
    const q = async (sql, params) => {
      chamadas.push({ sql, params });
      if (sql.includes('FOR UPDATE OF t')) return { rows: [{ nota, detalhes: { _quadros: [] }, notas: notasMusica }] };
      return { rows: sql.includes('RETURNING fila_id') ? [{ fila_id: '100', nota, detalhes: { afinacao: .7, suspeita: ['x'] }, fase: 'eliminatoria' }] : [] };
    };
    await dados.encerrarTentativa(q, 5, true);
    const fechamento = chamadas.find((c) => c.sql.includes('RETURNING fila_id'));
    assert.equal(fechamento.params[1], 'abandonada');
    assert.equal(fechamento.params[3], '[]');
    const gravacao = chamadas.find((c) => c.sql.includes('INSERT INTO karaoke_notas'));
    assert.equal(gravacao.params[1], nota ?? 0);
    // A cópia pública em karaoke_notas nunca leva a marca de suspeita.
    assert.deepEqual(JSON.parse(gravacao.params[3]), { afinacao: .7, prova: true, fase: 'eliminatoria', nivel: 'dificil' });
    assert.ok(chamadas.some((c) => c.sql.includes("status = 'feita'")));
  }
});
test('encerrar novamente não sobrescreve nota já consolidada', async () => {
  let chamadas = 0;
  await dados.encerrarTentativa(async () => { chamadas++; return { rows: [] }; }, 5, true);
  assert.equal(chamadas, 1);
});
test('ao encerrar, quadros fabricados gravam detalhes.suspeita com os motivos', async () => {
  const quadros = Array.from({ length: 400 }, (_, i) => ({ t: i * 33, m: i * 33 + 140, hz: 261.6255653, clareza: 0.99, rms: 0.1 }));
  let gravado;
  const q = async (sql, params) => {
    if (sql.includes('FOR UPDATE OF t')) return { rows: [{ nota: 98, detalhes: { _quadros: quadros }, notas: [{ inicio_ms: 0, dur_ms: 20000, midi: 60, linha: 0, golden: false }] }] };
    if (sql.includes('RETURNING fila_id')) { gravado = JSON.parse(params[3]); return { rows: [{ fila_id: '1', nota: 98, detalhes: {}, fase: 'eliminatoria' }] }; }
    return { rows: [] };
  };
  await dados.encerrarTentativa(q, 5, false);
  const m = gravado.join(' | ');
  for (const t of [/Clareza/, /Volume/, /Afinação perfeita/, /Intervalos/, /Nota 98/]) assert.match(m, t);
});
test('recuperação encerra como abandonadas as tentativas sem contato há 45 segundos', async () => {
  const chamadas = [];
  const q = async (sql, params) => {
    chamadas.push({ sql, params });
    if (sql.includes("INTERVAL '45 seconds'")) return { rows: [{ id: '5' }, { id: '6' }] };
    return { rows: [] };
  };
  assert.equal(await dados.recuperarInterrompidas(q, 2026), 2);
  assert.deepEqual(chamadas.filter((c) => c.sql.includes('FOR UPDATE OF t')).map((c) => c.params), [[5], [6]]);
});
test('recuperação funciona sozinha (cron): abre a própria transação, toma a trava e usa a edição atual', async () => {
  const antes = transacaoChamada;
  assert.equal(await dados.recuperarInterrompidas(), 1);
  assert.equal(transacaoChamada, antes + 1);
});
test('detalhes públicos escondem suspeita e anulação; painel do familiar não as expõe', async () => {
  assert.deepEqual(dados.detalhesPublicos({ afinacao: 1, suspeita: ['x'], anulacao: { motivo: 'y' } }), { afinacao: 1 });
  assert.deepEqual(dados.detalhesPublicos(undefined), {});
});
test('painel: familiar não recebe a lista da organização nem suspeitas; admin recebe', async () => {
  const config = { ano: 2026, musicas: ['1', '2', '3', '4', '5'], final_musica: null, status: 'eliminatoria', eliminatoria_ate: new Date(), final_em: new Date() };
  const tentativa = { id: '1', user_id: 1, catalogo_id: '1', fase: 'eliminatoria', fila_id: '9', nota: 50, detalhes: { suspeita: ['Nota 99'] }, status: 'valida' };
  const q = async (sql) => {
    if (sql.includes('FROM karaoke_prova WHERE')) return { rows: [config] };
    if (sql.includes('FROM karaoke_prova_tentativas WHERE ano')) return { rows: [tentativa] };
    if (sql.includes('JOIN karaoke_fila f ON f.id = t.fila_id')) return { rows: [{ id: '1', user_id: 1, nome: 'A', catalogo_id: '1', musica: 'M', fase: 'eliminatoria', nota: 50, status: 'valida', iniciada_em: new Date(), suspeita: ['Nota 99'], motivo_anulacao: null, video_url: 'https://v' }] };
    return { rows: [] };
  };
  const fam = await dados.painelProva(q, { id: 1, is_admin: false });
  assert.equal(fam.tentativas_admin, undefined);
  assert.equal(fam.minhas_tentativas[0].detalhes.suspeita, undefined);
  const adm = await dados.painelProva(q, { id: 2, is_admin: true });
  assert.equal(adm.tentativas_admin[0].video_url, 'https://v'); assert.deepEqual(adm.tentativas_admin[0].suspeita, ['Nota 99']);
});
test('tentativas anuladas ficam fora da classificação (consulta ignora status anulada)', async () => {
  let sqls = [];
  await dados.carregarTentativas(async (sql) => { sqls.push(sql); return { rows: [] }; }, 2026);
  assert.match(sqls[0], /status <> 'anulada'/);
});
