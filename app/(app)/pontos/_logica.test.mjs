import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

// Executar: node --test app/\(app\)/pontos/_logica.test.mjs
const js = ts.transpileModule(fs.readFileSync(new URL('./_logica.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);

const {
  filtrarExtratoPorOrigem,
  separarPodioEResto,
  calcularContagemRegressiva,
  formatarDiaExtrato,
  isoParaDatetimeLocalSP,
  datetimeLocalSPParaIso,
  textoExibicaoConquista,
  progressoConquistaPct,
  agruparConquistasPorCategoria,
  filtrarConquistasNovas,
  validarRespostaMissao,
} = mod.exports;

test('filtrarExtratoPorOrigem filtra lançamentos, recalcula soma do dia e omite dias vazios', () => {
  const extrato = [
    {
      dia: '2026-12-24',
      total: 45,
      lancamentos: [
        { regra: 'visita', origem: 'uso', pontos: 5, descricao: 'Abriu o app', ocorreu_em: '2026-12-24T10:00:00Z' },
        { regra: 'bingo', origem: 'brincadeira', pontos: 40, descricao: 'Bingo confirmado', ocorreu_em: '2026-12-24T22:00:00Z' },
      ],
    },
    {
      dia: '2026-12-23',
      total: 5,
      lancamentos: [
        { regra: 'visita', origem: 'uso', pontos: 5, descricao: 'Abriu o app', ocorreu_em: '2026-12-23T09:00:00Z' },
      ],
    },
  ];

  assert.equal(filtrarExtratoPorOrigem(extrato, 'todas').length, 2);
  const soBrincadeira = filtrarExtratoPorOrigem(extrato, 'brincadeira');
  assert.equal(soBrincadeira.length, 1);
  assert.equal(soBrincadeira[0].dia, '2026-12-24');
  assert.equal(soBrincadeira[0].total, 40);
  assert.equal(soBrincadeira[0].lancamentos.length, 1);
  assert.deepEqual(filtrarExtratoPorOrigem(extrato, 'karaoke'), []);
});

test('separarPodioEResto divide os 3 primeiros e o restante ordenado por posição', () => {
  const ranking = [
    { posicao: 2, user_id: 2, nome: 'Bia', avatar_url: null, total: 90, conquistas: 3 },
    { posicao: 1, user_id: 1, nome: 'Ana', avatar_url: null, total: 120, conquistas: 5 },
    { posicao: 4, user_id: 4, nome: 'Dani', avatar_url: null, total: 50, conquistas: 1 },
    { posicao: 3, user_id: 3, nome: 'Caio', avatar_url: null, total: 80, conquistas: 2 },
  ];
  const { podio, resto } = separarPodioEResto(ranking);
  assert.deepEqual(podio.map((p) => p.user_id), [1, 2, 3]);
  assert.deepEqual(resto.map((p) => p.user_id), [4]);
});

test('calcularContagemRegressiva calcula dias, horas, minutos e segundos restantes', () => {
  const agora = Date.parse('2026-12-22T20:00:00-03:00');
  const alvo = '2026-12-24T22:30:15-03:00';
  const r = calcularContagemRegressiva(alvo, agora);
  assert.equal(r.encerrado, false);
  assert.equal(r.dias, 2);
  assert.equal(r.horas, 2);
  assert.equal(r.minutos, 30);
  assert.equal(r.segundos, 15);
  assert.equal(r.textoCurto, '2d 02h 30min');

  const passado = calcularContagemRegressiva('2026-12-20T00:00:00-03:00', agora);
  assert.equal(passado.encerrado, true);
  assert.equal(passado.totalSegundos, 0);
});

test('formatarDiaExtrato e conversão de horário de São Paulo funcionam sem deslocar dia', () => {
  assert.equal(formatarDiaExtrato('2026-11-08'), '08/11/2026');
  const iso = '2026-12-24T22:00:00-03:00';
  const local = isoParaDatetimeLocalSP(iso);
  assert.equal(local, '2026-12-24T22:00');
  assert.equal(datetimeLocalSPParaIso(local), '2026-12-24T22:00:00-03:00');
});

test('conquistas secretas, progresso, agrupamento e filtro de conquistas novas', () => {
  const conquistas = [
    {
      id: 'sec_1',
      categoria: 'secretas',
      nome: '???',
      descricao: '???',
      nivel: 'lendaria',
      icone: 'Sparkles',
      secreta: true,
      pontos: 250,
      ganha_em: null,
      progresso: null,
      quantos_ganharam: 0,
    },
    {
      id: 'foto_1',
      categoria: 'fotografo',
      nome: 'Primeira foto',
      descricao: 'Mandou 1 foto no álbum',
      nivel: 'bronze',
      icone: 'Camera',
      secreta: false,
      pontos: 20,
      ganha_em: '2026-11-08T12:00:00Z',
      progresso: { atual: 1, meta: 1 },
      quantos_ganharam: 4,
    },
    {
      id: 'foto_2',
      categoria: 'fotografo',
      nome: 'Fotógrafo da família',
      descricao: 'Mandou 10 fotos no álbum',
      nivel: 'prata',
      icone: 'Camera',
      secreta: false,
      pontos: 50,
      ganha_em: null,
      progresso: { atual: 4, meta: 10 },
      quantos_ganharam: 1,
    },
  ];

  assert.deepEqual(textoExibicaoConquista(conquistas[0]), { nome: '???', descricao: '???', oculta: true });
  assert.equal(progressoConquistaPct(conquistas[0]), null);
  assert.equal(progressoConquistaPct(conquistas[1]), 100);
  assert.equal(progressoConquistaPct(conquistas[2]), 40);

  const grupos = agruparConquistasPorCategoria(conquistas, 'todas', 'todas');
  assert.equal(grupos.length, 2);
  assert.equal(grupos[0].categoria, 'fotografo');
  assert.equal(grupos[0].ganhas, 1);
  assert.equal(grupos[0].total, 2);

  const novas = filtrarConquistasNovas(conquistas, []);
  assert.deepEqual(novas.map((c) => c.id), ['foto_1']);
  assert.deepEqual(filtrarConquistasNovas(conquistas, ['foto_1']), []);
});

test('validarRespostaMissao respeita o tipo da missão (foto, texto, foto_texto)', () => {
  assert.equal(validarRespostaMissao('foto', '', '').ok, false);
  assert.equal(validarRespostaMissao('foto', '', 'https://img/1.jpg').ok, true);
  assert.equal(validarRespostaMissao('texto', 'oi', '').ok, false);
  assert.equal(validarRespostaMissao('texto', 'Minha lembrança de infância', '').ok, true);
  assert.equal(validarRespostaMissao('foto_texto', 'Texto válido', '').ok, false);
  assert.equal(validarRespostaMissao('foto_texto', '', 'https://img/1.jpg').ok, false);
  assert.equal(validarRespostaMissao('foto_texto', 'Texto válido', 'https://img/1.jpg').ok, true);
});
