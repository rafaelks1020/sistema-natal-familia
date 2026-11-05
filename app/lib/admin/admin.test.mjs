// node --test app/lib/admin/admin.test.mjs
// Garante que o registro do painel admin não expõe dado sigiloso e é coerente.
import test from 'node:test';
import assert from 'node:assert/strict';

const { RECURSOS, FERRAMENTAS, GRUPOS } = await import('./recursos.ts');
const { CHAVES_OCULTAS } = await import('./seguranca.ts');

const PROIBIDOS = ['secret_santa_draws', 'wish_list_compras', 'texto_lacrado', 'password', 'token', 'refresh'];
const TRAVESSOES = [String.fromCharCode(0x2013), String.fromCharCode(0x2014)];

test('o registro não menciona nada sigiloso', () => {
  const texto = JSON.stringify({ RECURSOS, FERRAMENTAS }).toLowerCase();
  for (const p of PROIBIDOS) assert.ok(!texto.includes(p), `registro cita "${p}"`);
});

test('ids são únicos, grupos existem e SQL não tem ponto e vírgula', () => {
  const ids = RECURSOS.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const r of RECURSOS) {
    assert.ok(GRUPOS.includes(r.grupo), `${r.id}: grupo ${r.grupo}`);
    assert.ok(r.tabelas.includes(r.tabela), `${r.id}: tabela principal fora de tabelas`);
    const sql = [r.from, r.filtro ?? '', ...r.busca, ...r.colunas.map((c) => c.sql)].join(' ');
    assert.ok(!sql.includes(';'), `${r.id}: ponto e vírgula no SQL`);
    assert.ok(r.colunas.length > 0 && r.busca.length > 0, `${r.id}: sem colunas ou busca`);
  }
});

test('campos editáveis existem nas colunas e opções são válidas', () => {
  for (const r of RECURSOS) {
    const campos = new Set(r.colunas.map((c) => c.campo));
    assert.equal(campos.size, r.colunas.length, `${r.id}: colunas repetidas`);
    for (const e of r.editaveis) {
      assert.ok(campos.has(e.campo), `${r.id}.${e.campo} editável fora das colunas`);
      if (e.tipo === 'opcao') assert.ok(e.opcoes?.length, `${r.id}.${e.campo} sem opções`);
    }
  }
});

test('pagamentos e acertos são só leitura (sem edição nem exclusão)', () => {
  for (const id of ['pagamentos', 'acertos_ceia']) {
    const r = RECURSOS.find((x) => x.id === id);
    assert.equal(r.editaveis.length, 0);
    assert.equal(r.pode_apagar, false);
  }
  assert.deepEqual(RECURSOS.find((x) => x.id === 'pagamentos').acoes.map((a) => a.id), ['conferir_no_banco']);
});

test('dicas saem sem o autor e a lista de desejos sem quem comprou', () => {
  const dicas = RECURSOS.find((r) => r.id === 'dicas');
  const sqlDicas = [dicas.from, ...dicas.colunas.map((c) => c.sql), ...dicas.busca].join(' ');
  assert.ok(!/user_id/.test(sqlDicas), 'dicas não pode ler user_id');
  const desejos = RECURSOS.find((r) => r.id === 'lista_desejos');
  assert.ok(!desejos.colunas.some((c) => /purchased|compra/i.test(c.sql + c.campo)));
  const denuncias = RECURSOS.find((r) => r.id === 'denuncias');
  assert.ok(!denuncias.colunas.some((c) => /autor_id/.test(c.sql)), 'denúncia não pode revelar o autor do conteúdo');
});

test('cápsula só mostra texto e foto depois de aberta', () => {
  const c = RECURSOS.find((r) => r.id === 'capsulas');
  for (const campo of ['texto', 'image_url']) {
    const col = c.colunas.find((x) => x.campo === campo);
    assert.match(col.sql, /CASE WHEN c\.abre_em <= NOW\(\)/);
  }
  assert.equal(c.editaveis.length, 0);
});

test('CPF só mascarado e nenhuma coluna lê hash ou chave de aparelho', () => {
  const todas = RECURSOS.flatMap((r) => r.colunas.map((c) => ({ r: r.id, c })));
  for (const { r, c } of todas) {
    if (/billing_cpf/.test(c.sql)) assert.match(c.sql, /right\(/, `${r}.${c.campo} expõe o CPF inteiro`);
    assert.ok(!/push_devices|_hash|pix_key|billing_address/.test(c.sql), `${r}.${c.campo} lê dado sigiloso`);
  }
});

test('ajustes escondem chaves com token, refresh ou secret', () => {
  const a = RECURSOS.find((r) => r.id === 'ajustes');
  assert.equal(a.chavesOcultas, true);
  assert.equal(a.pode_apagar, false);
  const re = new RegExp(CHAVES_OCULTAS, 'i');
  for (const chave of ['spotify_access_token', 'SPOTIFY_REFRESH', 'client_secret']) assert.ok(re.test(chave));
  for (const chave of ['event_title', 'amigo_tema', 'contribution_value']) assert.ok(!re.test(chave));
});

test('ferramentas apontam para telas com rota do site e do app', () => {
  assert.equal(FERRAMENTAS.length, 12);
  for (const f of FERRAMENTAS) {
    assert.ok(f.rota_site.startsWith('/') && f.rota_app.startsWith('/'));
  }
});

test('texto do painel sem travessão nem meia-risca', () => {
  const texto = JSON.stringify({ RECURSOS, FERRAMENTAS });
  for (const t of TRAVESSOES) assert.ok(!texto.includes(t));
});
