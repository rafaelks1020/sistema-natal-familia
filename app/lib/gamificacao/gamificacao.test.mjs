// node --test app/lib/gamificacao/gamificacao.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import * as LucideIcons from 'lucide-react';

const {
  aplicarTetosFatos,
  calcularLancamentosKaraoke,
  comentarioValidoParaPontos,
  configPadrao,
  edicaoEncerrada,
  agruparExtratoPorDia,
  montarRanking,
  pontosKaraokeApresentacao,
  postValidoParaPontos,
  rankingEstaOculto,
} = await import('./regras.ts');

const {
  CATALOGO_CONQUISTAS,
  avaliarConquistasAlcancadas,
  conquistasParaRevogar,
  metricasVazias,
  montarConquistasVistas,
  pontosDaConquista,
  progressoDaConquista,
} = await import('./catalogo.ts');

const {
  MODELOS_MISSAO,
  estadoMissao,
  horarioPermitidoPushSP,
  planejarMissaoSurpresa,
  validarConteudoMissao,
} = await import('./missoes.ts');

const CATEGORIAS_ESPERADAS = [
  'familia',
  'fotografo',
  'prosa',
  'advento',
  'ceia',
  'festa',
  'karaoke',
  'generoso',
  'memorias',
  'secretas',
];

const JANELA_2026 = {
  ano: 2026,
  encerra_em: configPadrao(2026).encerra_em,
};

test('configPadrao define encerra_em em 24/12 22:00 SP e ranking_oculto_em 48h antes', () => {
  const cfg = configPadrao(2026);
  assert.equal(cfg.encerra_em, new Date('2026-12-24T22:00:00-03:00').toISOString());
  assert.equal(cfg.ranking_oculto_em, new Date('2026-12-22T22:00:00-03:00').toISOString());
  assert.equal(cfg.revelado_em, null);
  assert.equal(cfg.missoes_surpresa, true);
});

test('ocultação do ranking respeita ranking_oculto_em e volta a exibir após revelado_em', () => {
  const cfg = configPadrao(2026);
  assert.equal(rankingEstaOculto(cfg, new Date('2026-12-22T21:59:59-03:00')), false);
  assert.equal(rankingEstaOculto(cfg, new Date('2026-12-22T22:00:00-03:00')), true);
  assert.equal(rankingEstaOculto(cfg, new Date('2026-12-24T21:00:00-03:00')), true);

  const revelado = { ...cfg, revelado_em: '2026-12-24T23:30:00-03:00' };
  assert.equal(rankingEstaOculto(revelado, new Date('2026-12-24T23:35:00-03:00')), false);
});

test('tetos por dia de São Paulo e tetos totais da edição funcionam corretamente', () => {
  const fatos = [];
  // 5 posts no mesmo dia SP (teto = 3/dia) e 2 no dia seguinte
  for (let i = 1; i <= 5; i++) {
    fatos.push({
      user_id: 1,
      origem: 'uso',
      regra: 'post',
      ref: `post:${i}`,
      pontos: 5,
      descricao: `Post ${i}`,
      ocorreu_em: `2026-11-10T1${i}:00:00-03:00`,
    });
  }
  for (let i = 6; i <= 7; i++) {
    fatos.push({
      user_id: 1,
      origem: 'uso',
      regra: 'post',
      ref: `post:${i}`,
      pontos: 5,
      descricao: `Post ${i}`,
      ocorreu_em: `2026-11-11T1${i - 5}:00:00-03:00`,
    });
  }
  // 5 receitas na edição (teto total = 3)
  for (let i = 1; i <= 5; i++) {
    fatos.push({
      user_id: 1,
      origem: 'uso',
      regra: 'receita',
      ref: `receita:${i}`,
      pontos: 20,
      descricao: `Receita ${i}`,
      ocorreu_em: `2026-11-1${i}T12:00:00-03:00`,
    });
  }

  const gerados = aplicarTetosFatos(fatos, JANELA_2026);
  const posts = gerados.filter((g) => g.regra === 'post');
  const receitas = gerados.filter((g) => g.regra === 'receita');

  assert.equal(posts.length, 5);
  assert.deepEqual(posts.map((p) => p.ref), ['post:1', 'post:2', 'post:3', 'post:6', 'post:7']);
  assert.equal(receitas.length, 3);
  assert.deepEqual(receitas.map((r) => r.ref), ['receita:1', 'receita:2', 'receita:3']);
});

test('corte por encerra_em, início da edição (1/11 SP) e anula_ref do admin', () => {
  const anulados = new Map([[1, new Set(['post|post:valido2'])]]);
  const fatos = [
    {
      user_id: 1,
      origem: 'uso',
      regra: 'post',
      ref: 'post:outubro',
      pontos: 5,
      descricao: 'Antes de 1/11',
      ocorreu_em: '2026-10-31T23:59:59-03:00',
    },
    {
      user_id: 1,
      origem: 'uso',
      regra: 'post',
      ref: 'post:valido1',
      pontos: 5,
      descricao: 'Dentro da janela',
      ocorreu_em: '2026-11-01T00:00:00-03:00',
    },
    {
      user_id: 1,
      origem: 'uso',
      regra: 'post',
      ref: 'post:valido2',
      pontos: 5,
      descricao: 'Anulado pelo admin',
      ocorreu_em: '2026-12-10T10:00:00-03:00',
    },
    {
      user_id: 1,
      origem: 'uso',
      regra: 'post',
      ref: 'post:no_limite',
      pontos: 5,
      descricao: 'Exatamente em encerra_em',
      ocorreu_em: '2026-12-24T22:00:00-03:00',
    },
    {
      user_id: 1,
      origem: 'uso',
      regra: 'post',
      ref: 'post:depois',
      pontos: 5,
      descricao: 'Um segundo após encerra_em',
      ocorreu_em: '2026-12-24T22:00:01-03:00',
    },
  ];

  const gerados = aplicarTetosFatos(fatos, { ...JANELA_2026, anulados });
  assert.deepEqual(gerados.map((g) => g.ref), ['post:valido1', 'post:no_limite']);
  assert.equal(edicaoEncerrada(JANELA_2026, new Date('2026-12-24T22:00:00-03:00')), false);
  assert.equal(edicaoEncerrada(JANELA_2026, new Date('2026-12-24T22:00:01-03:00')), true);
});

test('validação de tamanho mínimo de post (10+ letras ou foto) e comentário (3+ letras)', () => {
  assert.equal(postValidoParaPontos('Oi gente', false), false);
  assert.equal(postValidoParaPontos('Oi', true), true);
  assert.equal(postValidoParaPontos('Feliz Natal!', false), true);
  assert.equal(comentarioValidoParaPontos('Oi'), false);
  assert.equal(comentarioValidoParaPontos('   '), false);
  assert.equal(comentarioValidoParaPontos('Top'), true);
});

test('karaokê: multiplicador de nível, melhor nota por música, dueto e máximo de 10 músicas por dia', () => {
  assert.equal(pontosKaraokeApresentacao(80, 'normal'), 80);
  assert.equal(pontosKaraokeApresentacao(80, null), 80);
  assert.equal(pontosKaraokeApresentacao(81, 'dificil'), 97); // 81 * 1.2 = 97.2 -> 97
  assert.equal(pontosKaraokeApresentacao(81, 'facil'), 41); // 81 * 0.5 = 40.5 -> 41

  const apresentacoes = [
    // Mesma música cantada 2 vezes: deve prevalecer a maior pontuação ajustada (Difícil 80 * 1.2 = 96 vs Normal 90)
    { id: 1, user_id: 1, musica_id: 'catalogo:10', titulo: 'Noite Feliz', nota: 90, nivel: 'normal', ocorreu_em: '2026-12-20T18:00:00-03:00' },
    { id: 2, user_id: 1, musica_id: 'catalogo:10', titulo: 'Noite Feliz', nota: 80, nivel: 'dificil', ocorreu_em: '2026-12-20T19:00:00-03:00' },
    // Dueto: tanto user 1 quanto user 2 recebem os pontos
    { id: 3, user_id: 1, dueto_user_id: 2, musica_id: 'catalogo:20', titulo: 'Evidências', nota: 70, nivel: 'facil', ocorreu_em: '2026-12-20T19:30:00-03:00' },
  ];

  // Mais 10 músicas distintas para o user 1 no mesmo dia (total de 12 músicas distintas no dia 20/12 -> só as 10 maiores contam)
  for (let i = 1; i <= 10; i++) {
    apresentacoes.push({
      id: 100 + i,
      user_id: 1,
      musica_id: `catalogo:${100 + i}`,
      titulo: `Música Extra ${i}`,
      nota: 50 + i, // 51..60 pts
      nivel: 'normal',
      ocorreu_em: `2026-12-20T20:${String(i).padStart(2, '0')}:00-03:00`,
    });
  }

  const lancs = calcularLancamentosKaraoke(apresentacoes, JANELA_2026);
  const doUser1 = lancs.filter((l) => l.user_id === 1);
  const doUser2 = lancs.filter((l) => l.user_id === 2);

  assert.equal(doUser1.length, 10, 'user 1 deve ficar limitado a 10 músicas no dia');
  // A melhor de catalogo:10 foi 96 pts (Difícil), e as 9 maiores extras são 52..60 (35 pts do dueto Fácil e 51 pts ficam de fora do top 10 do user 1)
  assert.equal(doUser1.find((l) => l.ref === 'musica:catalogo:10')?.pontos, 96);
  assert.equal(doUser1.some((l) => l.ref === 'musica:catalogo:20'), false);

  // Já para o user 2 (que só cantou o dueto), o dueto entra normalmente com 35 pts
  assert.equal(doUser2.length, 1);
  assert.equal(doUser2[0].regra, 'karaoke_dueto');
  assert.equal(doUser2[0].pontos, 35);
});

test('catálogo tem 100+ conquistas em 10 categorias, escadas, secretas e conquistas de dinheiro com 0 pontos', () => {
  assert.ok(CATALOGO_CONQUISTAS.length >= 100, `esperado >= 100 conquistas, encontrou ${CATALOGO_CONQUISTAS.length}`);

  const ids = new Set(CATALOGO_CONQUISTAS.map((c) => c.id));
  assert.equal(ids.size, CATALOGO_CONQUISTAS.length, 'ids de conquistas devem ser únicos');

  const porCategoria = new Map();
  for (const c of CATALOGO_CONQUISTAS) {
    assert.ok(c.icone in LucideIcons, `ícone ${c.icone} da conquista ${c.id} não existe em lucide-react`);
    porCategoria.set(c.categoria, (porCategoria.get(c.categoria) ?? 0) + 1);
    if (c.dinheiro) {
      assert.equal(pontosDaConquista(c), 0, `conquista de dinheiro ${c.id} deve valer 0 pontos`);
    } else {
      assert.ok(pontosDaConquista(c) > 0, `conquista ${c.id} deve valer pontos > 0`);
    }
  }
  for (const cat of CATEGORIAS_ESPERADAS) {
    assert.ok((porCategoria.get(cat) ?? 0) >= 8, `categoria ${cat} deve ter conquistas suficientes`);
  }

  // Testa escada bronze -> prata -> ouro -> lendária de fotógrafo
  const m = metricasVazias();
  m.fotos_total = 12;
  const ganhas = new Set(avaliarConquistasAlcancadas(m).map((c) => c.id));
  assert.equal(ganhas.has('fotografo_bronze'), true);
  assert.equal(ganhas.has('fotografo_prata'), true);
  assert.equal(ganhas.has('fotografo_ouro'), false);
  assert.equal(ganhas.has('fotografo_lendaria'), false);

  const defOuro = CATALOGO_CONQUISTAS.find((c) => c.id === 'fotografo_ouro');
  assert.deepEqual(progressoDaConquista(defOuro, m), { atual: 12, meta: 25 });

  // Testa ocultação de conquista secreta ('???') até alguém ganhar
  const vistasAntes = montarConquistasVistas(m, new Map(), new Map());
  const secretaAntes = vistasAntes.find((c) => c.id === 'secreta_coruja');
  assert.equal(secretaAntes.nome, '???');
  assert.equal(secretaAntes.descricao, '???');
  assert.equal(secretaAntes.progresso, null);

  const vistasDepois = montarConquistasVistas(m, new Map(), new Map([['secreta_coruja', 2]]));
  const secretaDepois = vistasDepois.find((c) => c.id === 'secreta_coruja');
  assert.equal(secretaDepois.nome, 'Coruja de Natal');
  assert.equal(secretaDepois.quantos_ganharam, 2);
});

test('modelos de missão relâmpago (30+), janela de silêncio 22h-8h SP e sorteio de missão surpresa', () => {
  assert.ok(MODELOS_MISSAO.length >= 30, `esperado >= 30 modelos, encontrou ${MODELOS_MISSAO.length}`);
  const ids = new Set(MODELOS_MISSAO.map((m) => m.id));
  assert.equal(ids.size, MODELOS_MISSAO.length);
  for (const m of MODELOS_MISSAO) {
    assert.ok(m.pontos >= 20 && m.pontos <= 80, `modelo ${m.id} fora da faixa 20..80`);
  }

  // Janela de silêncio 22h-8h SP
  assert.equal(horarioPermitidoPushSP(new Date('2026-12-10T07:59:00-03:00')), false);
  assert.equal(horarioPermitidoPushSP(new Date('2026-12-10T08:00:00-03:00')), true);
  assert.equal(horarioPermitidoPushSP(new Date('2026-12-10T21:59:00-03:00')), true);
  assert.equal(horarioPermitidoPushSP(new Date('2026-12-10T22:00:00-03:00')), false);
  assert.equal(horarioPermitidoPushSP(new Date('2026-12-11T02:30:00-03:00')), false);

  // Não sorteia em novembro
  assert.equal(
    planejarMissaoSurpresa({
      ano: 2026,
      encerra_em: JANELA_2026.encerra_em,
      modelosUsados: new Set(),
      diasComMissao: new Set(),
      agora: new Date('2026-11-25T10:00:00-03:00'),
    }),
    null,
  );

  // Sorteia em dezembro quando ainda não há missão no dia
  const sorteada = planejarMissaoSurpresa({
    ano: 2026,
    encerra_em: JANELA_2026.encerra_em,
    modelosUsados: new Set(),
    diasComMissao: new Set(),
    agora: new Date('2026-12-05T09:00:00-03:00'),
    aleatorio: () => 0.5,
  });
  assert.ok(sorteada);
  assert.equal(
    estadoMissao(sorteada.inicia_em, sorteada.termina_em, JANELA_2026.encerra_em, new Date('2026-12-05T09:00:00-03:00')),
    'agendada',
  );
  assert.equal(validarConteudoMissao('foto', 'Legenda', null), 'Envie uma foto para cumprir esta missão.');
  assert.equal(validarConteudoMissao('foto_texto', 'Oi', 'https://blob.exemplo/a.jpg'), 'Esta missão pede uma foto acompanhada de um pequeno texto (3+ letras).');
  assert.equal(validarConteudoMissao('foto_texto', 'Minha foto!', 'https://blob.exemplo/a.jpg'), null);
});

test('agruparExtratoPorDia e montarRanking ordenam corretamente', () => {
  const extrato = agruparExtratoPorDia([
    { regra: 'visita', origem: 'uso', pontos: 5, descricao: 'Visita 1', ocorreu_em: '2026-11-08T10:00:00-03:00' },
    { regra: 'post', origem: 'uso', pontos: 5, descricao: 'Post 1', ocorreu_em: '2026-11-09T11:00:00-03:00' },
    { regra: 'post', origem: 'uso', pontos: 5, descricao: 'Post 2', ocorreu_em: '2026-11-08T15:00:00-03:00' },
  ]);
  assert.equal(extrato.length, 2);
  assert.equal(extrato[0].dia, '2026-11-09');
  assert.equal(extrato[1].dia, '2026-11-08');
  assert.equal(extrato[1].total, 10);

  const ranking = montarRanking(
    [
      { id: 1, nome: 'Ana', avatar_url: null },
      { id: 2, nome: 'Beto', avatar_url: null },
      { id: 3, nome: 'Carla', avatar_url: null },
    ],
    new Map([[1, 100], [2, 150], [3, 100]]),
    new Map([[1, 3], [2, 2], [3, 5]]),
  );
  assert.deepEqual(ranking.map((r) => [r.posicao, r.user_id, r.total]), [
    [1, 2, 150],
    [2, 3, 100],
    [3, 1, 100],
  ]);

  // Excluídos ficam fora do ranking e posições são renumeradas
  const rankingSemBeto = montarRanking(
    [
      { id: 1, nome: 'Ana', avatar_url: null },
      { id: 2, nome: 'Beto', avatar_url: null },
      { id: 3, nome: 'Carla', avatar_url: null },
    ],
    new Map([[1, 100], [2, 150], [3, 100]]),
    new Map([[1, 3], [2, 2], [3, 5]]),
    [2],
  );
  assert.deepEqual(rankingSemBeto.map((r) => [r.posicao, r.user_id, r.total]), [
    [1, 3, 100],
    [2, 1, 100],
  ]);
});

test('reações no mesmo post contam uma única vez por pessoa e conquistas de conteúdo apagado são revogadas antes de revelar', () => {
  const reacoesMesmoPost = [
    {
      user_id: 7,
      origem: 'uso',
      regra: 'reacao',
      ref: 'reacao:post:42',
      pontos: 1,
      descricao: 'Coração no post 42',
      ocorreu_em: '2026-12-01T10:00:00-03:00',
    },
    {
      user_id: 7,
      origem: 'uso',
      regra: 'reacao',
      ref: 'reacao:post:42',
      pontos: 1,
      descricao: 'Fogo no post 42',
      ocorreu_em: '2026-12-01T10:01:00-03:00',
    },
  ];
  const geradas = aplicarTetosFatos(reacoesMesmoPost, JANELA_2026);
  assert.equal(geradas.length, 1);
  assert.equal(geradas[0].ref, 'reacao:post:42');

  // Quando o post único é apagado, post_bronze é revogada enquanto revelado_em for null,
  // mas conquistas de presença/veterano/vaquinha permanecem intocadas.
  const m = metricasVazias();
  m.posts = 0;
  const revogadas = conquistasParaRevogar(
    ['post_bronze', 'fotografo_bronze', 'presente', 'veterano', 'vaquinha', 'visita_bronze'],
    m,
    null,
  );
  assert.deepEqual(revogadas, ['post_bronze', 'fotografo_bronze']);

  // Após revelado_em, nada mais é revogado.
  assert.deepEqual(
    conquistasParaRevogar(['post_bronze', 'fotografo_bronze'], m, '2026-12-24T23:30:00-03:00'),
    [],
  );
});

test('nenhum arquivo da parte P1 contém travessão ou meia-risca', () => {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const arquivos = [
    'migrations/046-gamificacao.sql',
    'migrations/048-web-push.sql',
    'app/lib/gamificacao/tipos.ts',
    'app/lib/gamificacao/regras.ts',
    'app/lib/gamificacao/catalogo.ts',
    'app/lib/gamificacao/missoes.ts',
    'app/lib/gamificacao/motor.ts',
    'app/lib/gamificacao/painel.ts',
    'app/lib/gamificacao/gamificacao.test.mjs',
    'app/lib/tarefas/gamificacao.ts',
    'app/lib/conquistas.ts',
    'app/api/cron/frequente/route.ts',
    'app/api/pontos/route.ts',
    'app/api/pontos/[userId]/route.ts',
    'app/api/missoes/route.ts',
    'app/api/missoes/[id]/responder/route.ts',
    'app/api/admin/gamificacao/route.ts',
    'app/api/admin/gamificacao/ajustes/route.ts',
    'app/api/admin/gamificacao/missoes/route.ts',
    'app/api/admin/gamificacao/missoes/respostas/[id]/route.ts',
    'app/api/admin/gamificacao/revelar/route.ts',
    'app/api/telao/gamificacao/route.ts',
    'app/(app)/mural/_components/NotificationsSheet.tsx',
    'app/(app)/admin/gamificacao/_client.tsx',
  ];
  const proibidos = [String.fromCharCode(0x2013), String.fromCharCode(0x2014)];
  for (const rel of arquivos) {
    const conteudo = fs.readFileSync(path.join(raiz, rel), 'utf8');
    for (const ch of proibidos) {
      assert.equal(conteudo.includes(ch), false, `arquivo ${rel} contém caractere proibido`);
    }
  }
});
