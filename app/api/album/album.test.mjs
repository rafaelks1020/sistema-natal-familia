import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

// Executar: node --test app/api/album/album.test.mjs. Sem conexão com banco.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const nativeRequire = createRequire(import.meta.url);
const blob = 'https://fotos.public.blob.vercel-storage.com/natal.jpg';
const member = { id: 7, name: 'Ana', is_admin: false, participant_id: null };
function photo(overrides = {}) {
  return { id: 42, key: 'album-42-0', source: 'album', url: blob, ano: 2025, user_id: 7,
    caption: 'Natal em casa', author_name: 'Ana', author_avatar: null, likes: 3, comments: 0,
    liked: false, sort_date: '2025-12-24T12:00:00.123456', created_at: '2025-12-24T12:00:00.123456-03:00', taken_on: '2025-12-24', ...overrides };
}
function harness({ now = '2026-11-05T18:00:00Z', user = member, tree = false, resolve } = {}) {
  const calls = []; const cache = new Map(); const saved = new Map(); const pushes = []; let nextId = 1;
  const CurrentDate = class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return new Date(now).getTime(); } };
  async function query(sql, params = []) {
    calls.push({ sql, params });
    const custom = resolve?.(sql, params); if (custom !== undefined) return { rows: custom };
    if (sql.includes("to_regclass('public.family_tree_people')")) return { rows: [{ exists: tree }] };
    if (sql.includes("to_regclass('public.family_official_photos')")) return { rows: [{ exists: false }] };
    if (sql.startsWith('SELECT id, name FROM family_users')) return { rows: [{ id: 7, name: 'Ana' }, { id: 8, name: 'Bia' }] };
    if (sql.startsWith('SELECT to_jsonb(p)')) return { rows: [{ person: { id: 20, nome: 'Ana', user_id: 7 } }, { person: { id: 21, nome: 'Vovó' } }] };
    if (sql.includes('SELECT * FROM photos WHERE key = $2')) return { rows: [photo()] };
    if (sql.startsWith('INSERT INTO album_photos')) {
      const key = `${params[1]}:${params[5]}`;
      if (!saved.has(key)) saved.set(key, { id: nextId++, ano: params[0], image_url: params[2] });
      return { rows: [saved.get(key)] };
    }
    return { rows: [] };
  }
  const session = { getSessionUser: async () => user };
  const db = { query, transaction: async fn => fn(query) };
  function load(relative) {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const compiledModule = { exports: {} }; cache.set(filename, compiledModule);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    const context = vm.createContext({ Date: CurrentDate, Buffer, URL, Request, Response, console });
    const execute = new vm.Script(`(function(exports, require, module) { ${code}\n})`, { filename }).runInContext(context);
    execute(compiledModule.exports, spec => {
      if (spec === 'server-only') return {};
      if (spec === '@/app/lib/db') return db;
      if (spec === '@/app/lib/push') return { enviarPush: (ids, msg) => { pushes.push({ ids, msg }); } };
      if (spec === './session' && filename.endsWith('/lib/api.ts')) return session;
      if (spec === '@/app/lib/api') return load('app/lib/api.ts');
      if (spec.startsWith('@/')) return load(`${spec.slice(2)}.ts`);
      if (spec.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), `${spec}.ts`)));
      return nativeRequire(spec);
    }, compiledModule);
    return compiledModule.exports;
  }
  return { calls, load, saved, pushes };
}
function request(body, method = 'POST') { return new Request('https://familia.test/api/album', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
const upload = (extra = {}) => ({ ano: 2025, taken_on: '2025-12-24', caption: 'Natal', people: ['user:8'], photos: [{ url: blob, client_key: 'envio-1' }], ...extra });
function mutations(h) { return h.calls.filter(c => /^(INSERT|UPDATE|DELETE)/.test(c.sql)); }

test('ano usa a edição atual e aceita histórico, com virada em março', () => {
  const h = harness(); const data = h.load('app/api/album/data.ts');
  assert.equal(data.albumYear(), 2026); assert.equal(data.albumYear('2025'), 2025);
  for (const value of [2027, 1899, 2025.5, null, 'abc']) assert.throws(() => data.albumYear(value), error => error.status === 400);
  assert.equal(harness({ now: '2027-02-01T15:00:00Z' }).load('app/api/album/data.ts').albumYear(), 2026);
});
test('JSON nulo ou lista recebe 400', async () => {
  const route = harness().load('app/api/album/route.ts');
  for (const body of [null, [], 'texto']) assert.equal((await route.POST(request(body))).status, 400);
});
test('metadados toleram árvore ausente e preferem contas reais quando ela existe', async () => {
  const absent = harness(); const meta = await absent.load('app/api/album/data.ts').getAlbumMetadata(member);
  assert.deepEqual(Array.from(meta.years), [2026, 2025]); assert.equal(meta.people.length, 2);
  assert.equal(absent.calls.some(c => c.sql.startsWith('SELECT to_jsonb')), false);
  const present = harness({ tree: true }); const people = await present.load('app/api/album/data.ts').getPeople(member);
  assert.equal(people.length, 3); assert.equal(people[2].name, 'Vovó'); assert.equal(people[2].source, 'tree');
});
test('paginação mantém microssegundos, identidade e filtro vazio', async () => {
  const rows = [photo({ key: 'album-43-0', id: 43 }), photo(), photo({ key: 'post-1-0', source: 'post', id: 1 })];
  const h = harness({ resolve: sql => sql.includes('SELECT * FROM photos p') ? rows : undefined });
  const data = h.load('app/api/album/data.ts'); const page = await data.getAlbum(member, { ano: 2025, limit: 2, pessoa: '' });
  assert.equal(page.items.length, 2); assert.equal(page.items[0].photo_id, 43); assert.equal('sort_date' in page.items[0], false);
  assert.deepEqual(JSON.parse(Buffer.from(page.nextCursor, 'base64url')), { date: rows[1].sort_date, key: rows[1].key });
  const first = h.calls.find(c => c.sql.includes('SELECT * FROM photos p'));
  assert.deepEqual(Array.from(first.params), [7, 2025, null, null, null, 3]);
  await data.getAlbum(member, { ano: 2025, limit: 2, cursor: page.nextCursor, pessoa: 'user:8' });
  const last = h.calls.filter(c => c.sql.includes('SELECT * FROM photos p')).at(-1);
  assert.deepEqual(Array.from(last.params), [7, 2025, 'user:8', rows[1].sort_date, rows[1].key, 3]);
  for (const args of [{ limit: 0 }, { limit: 101 }, { pessoa: 'x' }, { cursor: 'inválido' }]) await assert.rejects(data.getAlbum(member, args), error => error.status === 400);
});
test('envio de 30 fotos usa a sessão e nunca grava no mural ou em notificações', async () => {
  const h = harness(); const route = h.load('app/api/album/route.ts');
  const response = await route.POST(request(upload({ user_id: 999, photos: Array.from({ length: 30 }, (_, i) => ({ url: blob, client_key: `envio-${i}` })) })));
  assert.equal(response.status, 201); assert.equal((await response.json()).ids.length, 30);
  const writes = mutations(h); assert.equal(writes.filter(c => c.sql.startsWith('INSERT INTO album_photos')).length, 30);
  assert.equal(writes.every(c => c.params[0] === 2025), true);
  assert.equal(writes.filter(c => c.sql.startsWith('INSERT INTO album_photos')).every(c => c.params[1] === 7), true);
  assert.equal(writes.some(c => /family_posts|family_notifications/.test(c.sql)), false);
});
test('envios repetidos usam a mesma chave e não duplicam fotos', async () => {
  const h = harness(); const route = h.load('app/api/album/route.ts');
  const first = await (await route.POST(request(upload()))).json(); const second = await (await route.POST(request(upload()))).json();
  assert.deepEqual(first.ids, second.ids); assert.equal(h.saved.size, 1);
  assert.equal((await route.POST(request(upload({ ano: 2026, taken_on: '2026-12-24' })))).status, 409);
});
test('validação rejeita excesso, URL externa, data inválida e pessoa inexistente antes de escrever', async () => {
  for (const body of [upload({ photos: [] }), upload({ photos: Array(31).fill({ url: blob, client_key: 'x' }) }),
    upload({ photos: [{ url: 'https://externo.test/foto.jpg', client_key: 'x' }] }), upload({ taken_on: '2025-02-30' }),
    upload({ taken_on: '2026-12-24' }), upload({ people: ['user:999'] }), upload({ people: 'user:8' }), upload({ caption: 'x'.repeat(501) })]) {
    const h = harness(); assert.equal((await h.load('app/api/album/route.ts').POST(request(body))).status, 400); assert.equal(mutations(h).length, 0);
  }
});
test('marcação e exclusão exigem autor ou organizador', async () => {
  const h = harness({ user: { ...member, id: 8 } });
  assert.equal((await h.load('app/api/album/tags/route.ts').PUT(request({ key: 'album-42-0', people: [] }, 'PUT'))).status, 403);
  assert.equal((await h.load('app/api/album/route.ts').DELETE(request({ key: 'album-42-0' }, 'DELETE'))).status, 403);
  assert.equal(mutations(h).length, 0);
  const admin = harness({ user: { ...member, id: 8, is_admin: true } });
  assert.equal((await admin.load('app/api/album/route.ts').DELETE(request({ key: 'album-42-0' }, 'DELETE'))).status, 200);
  assert.equal(admin.calls.find(c => c.sql.includes('SELECT * FROM photos WHERE key')).params[0], null);
});
test('marcações substituem lista sem aceitar identidade do corpo', async () => {
  const h = harness(); const response = await h.load('app/api/album/tags/route.ts').PUT(request({ key: 'album-42-0', people: ['user:8', 'user:8'], user_id: 999 }, 'PUT'));
  assert.equal(response.status, 200); const writes = mutations(h); assert.equal(writes[0].sql.startsWith('DELETE FROM album_tags'), true);
  assert.equal(writes[1].params[0], 2025); assert.equal(writes[1].params[2], 7); assert.deepEqual(Array.from(writes[1].params[3]), ['user:8']);
});
test('exclusão do álbum não remove publicações do mural', async () => {
  const h = harness({ resolve: sql => sql.includes('SELECT * FROM photos WHERE key') ? [photo({ source: 'post', key: 'post-42-0' })] : undefined });
  assert.equal((await h.load('app/api/album/route.ts').DELETE(request({ key: 'post-42-0' }, 'DELETE'))).status, 400); assert.equal(mutations(h).length, 0);
});
test('denúncias têm fila exclusiva do organizador e autor da sessão', async () => {
  const h = harness(); const route = h.load('app/api/album/reports/route.ts');
  assert.equal((await route.GET(new Request('https://familia.test/api/album/reports'))).status, 403);
  assert.equal((await route.PATCH(request({ id: 1 }, 'PATCH'))).status, 403);
  assert.equal((await route.POST(request({ key: 'album-42-0', motivo: 'Foto indevida', user_id: 99 }))).status, 201);
  assert.deepEqual(Array.from(mutations(h)[0].params), [2025, 42, 7, 'Foto indevida']);
  assert.equal(mutations(h).some((c) => c.sql.includes('family_notifications')), true);
  assert.equal(h.pushes.length, 1);
  assert.equal(h.pushes[0].msg.titulo, 'Nova denúncia');
  assert.equal(h.pushes[0].msg.rota, '/album');
  const admin = harness({ user: { ...member, is_admin: true } }).load('app/api/album/reports/route.ts');
  assert.equal((await admin.PATCH(request({ id: 1e15 }, 'PATCH'))).status, 400);
});
test('denúncia aberta da mesma foto não grava nem avisa de novo', async () => {
  const h = harness({ resolve: (sql) => sql.startsWith('SELECT id FROM album_photo_reports') ? [{ id: 9 }] : undefined });
  const route = h.load('app/api/album/reports/route.ts');
  const res = await route.POST(request({ key: 'album-42-0', motivo: 'Foto indevida' }));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(mutations(h).length, 0);
  assert.equal(h.pushes.length, 0);
});
test('edição anterior aceita janeiro e fevereiro do ano seguinte e recusa março', async () => {
  for (const taken_on of ['2026-01-01', '2026-02-28']) {
    const h = harness();
    const res = await h.load('app/api/album/route.ts').POST(request(upload({ taken_on })));
    assert.equal(res.status, 201);
    assert.equal(mutations(h).find((c) => c.sql.startsWith('INSERT INTO album_photos')).params[4], taken_on);
  }
  const marco = harness();
  assert.equal((await marco.load('app/api/album/route.ts').POST(request(upload({ taken_on: '2026-03-01' })))).status, 400);
  assert.equal(mutations(marco).length, 0);
  const mesmoAno = harness();
  assert.equal((await mesmoAno.load('app/api/album/route.ts').POST(request(upload({ taken_on: '2025-01-15' })))).status, 201);
});
test('curtidas são idempotentes e vinculadas à sessão', async () => {
  const h = harness(); const route = h.load('app/api/album/likes/route.ts');
  assert.equal((await route.PUT(request({ key: 'album-42-0', liked: true }, 'PUT'))).status, 200);
  assert.deepEqual(Array.from(mutations(h)[0].params), [2025, 42, 7]);
  assert.equal((await route.PUT(request({ key: 'album-42-0', liked: false }, 'PUT'))).status, 200);
  assert.deepEqual(Array.from(mutations(h)[1].params), [42, 7]);
  assert.equal((await route.PUT(request({ key: 'album-42-0', liked: 'sim' }, 'PUT'))).status, 400);
});
test('retrospectiva libera em 25/12 em São Paulo, com acesso antecipado do organizador', async () => {
  const before = harness({ now: '2026-12-25T02:59:59Z' }); const memory = before.load('app/api/memorias/data.ts');
  assert.equal(memory.retrospectiveAvailable(member, 2026), false); assert.equal(memory.retrospectiveAvailable({ ...member, is_admin: true }, 2026), true);
  await assert.rejects(memory.getRetrospective(member, 2026), error => error.status === 403); assert.equal(before.calls.length, 0);
  assert.equal(harness({ now: '2026-12-25T03:00:00Z' }).load('app/api/memorias/data.ts').retrospectiveAvailable(member, 2026), true);
});
test('Neste dia usa dia e mês de São Paulo e edições anteriores', async () => {
  const h = harness({ now: '2026-12-25T02:00:00Z' });
  await h.load('app/api/memorias/data.ts').getOnThisDay(member);
  assert.deepEqual(Array.from(h.calls[0].params), [7, 2026, '12-24']); assert.equal(h.calls[0].sql.includes('ano < $2'), true);
});
test('linha do tempo prioriza foto oficial e tem fallback da mais curtida', async () => {
  for (const official of [false, true]) {
    const h = harness({ resolve: sql => {
      if (sql.includes("to_regclass('public.family_official_photos')")) return [{ exists: official }];
      if (sql.startsWith('SELECT ano, image_url FROM family_official_photos')) return [{ ano: 2025, image_url: `${blob}?oficial` }];
      if (sql.includes('SELECT p.ano, count(*)::int AS photos')) return [{ ano: 2025, photos: 10, comments: 6, people: 3 }];
      if (sql.startsWith('SELECT DISTINCT ON(p.ano)')) return [{ ano: 2025, name: 'Bia', count: 4 }];
      if (sql.includes('row_number() OVER')) return [photo({ rank: '1' })];
      return undefined;
    } });
    const editions = await h.load('app/api/memorias/data.ts').getTimeline(member);
    assert.equal(editions[0].cover, official ? `${blob}?oficial` : blob); assert.equal(editions[0].photos, 10);
    assert.equal(editions[0].topPoster.name, 'Bia'); assert.equal('rank' in editions[0].highlights[0], false);
    assert.equal(h.calls.some(c => c.sql.startsWith('SELECT ano, image_url FROM family_official_photos')), official);
  }
});
test('rotas exigem autenticação antes de ler ou gravar', async () => {
  const h = harness({ user: null }); const route = h.load('app/api/album/route.ts');
  assert.equal((await route.GET(new Request('https://familia.test/api/album'))).status, 401);
  assert.equal((await route.POST(request(upload()))).status, 401); assert.equal(h.calls.length, 0);
});

test('retrospectiva monta números, favoritos, conversas e encerramento sem repetir o mesmo post', async () => {
  const h = harness({ resolve: sql => {
    if (sql.includes('SELECT p.ano, count(*)::int AS photos')) return [{ ano: 2025, photos: 4, comments: 9, people: 2 }];
    if (sql.startsWith('SELECT DISTINCT ON(p.ano)')) return [{ ano: 2025, name: 'Bia', count: 6 }];
    if (sql.includes('row_number() OVER')) return [photo()];
    if (sql.includes('SELECT * FROM photos p')) return [photo(), photo({ source: 'post', id: 5, key: 'post-5-0', post_id: 5, comments: 9 }), photo({ source: 'post', id: 5, key: 'post-5-1', post_id: 5, comments: 9 })];
    return undefined;
  } });
  const retrospective = await h.load('app/api/memorias/data.ts').getRetrospective(member, 2025);
  assert.equal(retrospective.slides[0].title, 'Nosso Natal de 2025');
  assert.equal(retrospective.slides[1].text, '4 fotos, 9 comentários e 2 pessoas nas memórias.');
  assert.equal(retrospective.slides.find(s => s.title === 'Quem mais compartilhou').text, 'Bia publicou 6 vezes no mural.');
  assert.equal(retrospective.slides.filter(s => s.title === 'Uma boa conversa').length, 1);
  assert.equal(retrospective.slides.at(-1).title, 'Até o próximo Natal');
});
