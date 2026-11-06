import 'server-only';
import { query } from '@/app/lib/db';
import { edicaoAtual, hojeSP } from '@/app/lib/edicao';
import { padraoDoDia, situacaoAdvento } from '@/app/lib/advento';
import type { SessionUser } from '@/app/lib/session';
import { loadLive } from '@/app/api/secret-santa/features';
import { tocando as lerTocandoDoSpotify } from '@/app/api/spotify/_service';
import { getScreen } from '../data';
import {
  ehCena, type AdventoHoje, type ControleTelao, type EstadoTelao, type EventoTelao, type Jogo, type JogoAmigo, type JogoBingo,
  type JogoEnquete, type JogoQuiz, type PlacarItem, type Recado, type Secao, type TocandoTelao,
} from '@/app/telao/tipos';
import { parsePostImages } from '@/app/api/posts/_utils';

const QUIZ_MS = 20_000;
const QUIZ_REVELACAO_MS = 30_000;
const QUIZ_PODIO_MS = 90_000;
const SEM_MUSICA: TocandoTelao = { tocando: false, nome: null, artista: null, capa_url: null, progresso_ms: 0, duracao_ms: 0, adicionada_por: null };

const semTabela = (e: unknown) => (e as { code?: string } | null)?.code === '42P01';
const bloqueio = (coluna: string, param: string) =>
  `NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id = ${param} AND b.blocked_id = ${coluna}) OR (b.blocker_id = ${coluna} AND b.blocked_id = ${param}))`;

async function lerControle(ano: number): Promise<ControleTelao> {
  const vazio: ControleTelao = { cena_fixa: null, pausado: false, comando: null };
  try {
    const { rows } = await query<{ cena_fixa: string | null; pausado: boolean; comando: string | null; comando_em: Date | null; idade_ms: number | null }>(
      `SELECT cena_fixa, pausado, comando, comando_em,
              (EXTRACT(EPOCH FROM (NOW() - comando_em)) * 1000)::float8 AS idade_ms
         FROM telao_state WHERE ano = $1`, [ano]);
    const r = rows[0];
    if (!r) return vazio;
    let comando: ControleTelao['comando'] = null;
    if (r.comando && r.comando_em) {
      const idade_ms = Math.max(0, Number(r.idade_ms ?? 0));
      const id = new Date(r.comando_em).toISOString();
      if (r.comando === 'proxima' || r.comando === 'anterior') comando = { id, tipo: r.comando, texto: '', idade_ms };
      else if (r.comando.startsWith('aviso:')) comando = { id, tipo: 'aviso', texto: r.comando.slice(6).slice(0, 160), idade_ms };
    }
    return { cena_fixa: ehCena(r.cena_fixa) ? r.cena_fixa : null, pausado: Boolean(r.pausado), comando };
  } catch (e) {
    // Migração 032 ainda não aplicada: o telão segue no ciclo automático.
    if (semTabela(e)) return vazio;
    throw e;
  }
}

async function lerEvento(ano: number): Promise<EventoTelao> {
  const { rows } = await query<{ value: string }>("SELECT value FROM app_settings WHERE key = 'event_date'");
  const bruto = rows[0]?.value;
  const ceia = bruto && !Number.isNaN(Date.parse(bruto)) ? new Date(bruto) : new Date(`${ano}-12-24T20:00:00-03:00`);
  const dia = hojeSP(ceia);
  const meiaNoite = new Date(new Date(`${dia}T00:00:00-03:00`).getTime() + 86_400_000);
  // No dia 24, depois das 20h, a contagem já mira a meia-noite.
  const vinteH = new Date(`${dia}T20:00:00-03:00`);
  const troca = dia.endsWith('-12-24') && vinteH < ceia ? vinteH : ceia;
  return { ceia: ceia.toISOString(), troca: troca.toISOString(), meiaNoite: meiaNoite.toISOString() };
}

async function lerMarca(ano: number): Promise<string> {
  const { rows } = await query<{ m: string }>(
    `SELECT concat_ws('.',
        (SELECT COALESCE(MAX(id), 0) FROM family_posts WHERE created_at >= $1::timestamp AND created_at < $2::timestamp),
        (SELECT COUNT(*) FROM family_posts WHERE created_at >= $1::timestamp AND created_at < $2::timestamp),
        (SELECT COALESCE(MAX(id), 0) FROM party_photo_entries WHERE ano = $3),
        (SELECT COUNT(*) FROM party_photo_entries WHERE ano = $3),
        (SELECT COALESCE(MAX(id), 0) FROM purchases WHERE ano = $3),
        (SELECT COUNT(*) FROM purchases WHERE ano = $3)) AS m`,
    [`${ano}-03-01`, `${ano + 1}-03-01`, ano]);
  return rows[0]?.m ?? '';
}

async function lerTocando(): Promise<TocandoTelao | null> {
  try {
    const t = await Promise.race([lerTocandoDoSpotify(), new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500))]);
    if (!t) return null;
    // Spotify desconectado: o telão trata como "nada tocando" e não mostra a cena.
    if ('precisa_reconectar' in t) return SEM_MUSICA;
    return t;
  } catch {
    return null;
  }
}

async function placarQuiz(me: SessionUser, ano: number, perguntaId: number | null, status: string, limite: number): Promise<PlacarItem[]> {
  const { rows } = await query<{ nome: string; pontos: number; acertos: number }>(
    `SELECT u.name AS nome, COALESCE(SUM(a.pontos), 0)::int AS pontos,
            COALESCE(SUM(CASE WHEN a.acertou THEN 1 ELSE 0 END), 0)::int AS acertos
       FROM party_quiz_answers a
       JOIN party_quiz_questions q ON q.id = a.question_id AND q.ano = a.ano
       JOIN family_users u ON u.id = a.user_id
      WHERE a.ano = $1 AND q.encerrada = true
        AND NOT (q.id = COALESCE($2, -1) AND $3 = 'aberta')
        AND ${bloqueio('a.user_id', '$4')}
      GROUP BY u.id, u.name
      ORDER BY pontos DESC, acertos DESC, AVG(a.tempo_ms) ASC, u.name ASC
      LIMIT $5`,
    [ano, perguntaId, status, me.id, limite]);
  return rows;
}

async function jogoQuiz(me: SessionUser, ano: number): Promise<JogoQuiz | null> {
  const { rows } = await query<{
    status: string; question_id: number | null; passou_ms: number | null; fim_ms: number | null; atualizado_ms: number;
    modelo: string | null; pergunta: string | null; image_url: string | null; opcoes: unknown; correta: number | null;
    total_respostas: number | null; numero: number | null; total: number | null;
  }>(
    `SELECT s.status, s.question_id,
            (EXTRACT(EPOCH FROM (NOW() - s.aberta_em)) * 1000)::float8 AS passou_ms,
            (EXTRACT(EPOCH FROM (NOW() - s.encerrada_em)) * 1000)::float8 AS fim_ms,
            (EXTRACT(EPOCH FROM (NOW() - s.updated_at)) * 1000)::float8 AS atualizado_ms,
            q.modelo, q.pergunta, q.image_url, q.opcoes, q.correta,
            (SELECT COUNT(*)::int FROM party_quiz_answers a WHERE a.question_id = q.id AND a.ano = s.ano) AS total_respostas,
            (SELECT COUNT(*)::int FROM party_quiz_questions x WHERE x.ano = s.ano AND (x.ordem, x.id) <= (q.ordem, q.id)) AS numero,
            (SELECT COUNT(*)::int FROM party_quiz_questions x WHERE x.ano = s.ano) AS total
       FROM party_quiz_state s
       LEFT JOIN party_quiz_questions q ON q.id = s.question_id AND q.ano = s.ano
      WHERE s.ano = $1`, [ano]);
  const s = rows[0];
  if (!s || s.status === 'preparando') return null;
  const base = { tipo: 'quiz' as const, duracao_ms: QUIZ_MS };
  if (s.status === 'podio') {
    if (Number(s.atualizado_ms) > QUIZ_PODIO_MS) return null;
    const placar = await placarQuiz(me, ano, null, s.status, 8);
    return { ...base, fase: 'podio', numero: 0, total: Number(s.total ?? 0), modelo: '', pergunta: 'Pódio do quiz', image_url: null, opcoes: [],
      correta: null, total_respostas: 0, restante_ms: 0, placar };
  }
  if (!s.question_id || s.pergunta == null) return null;
  const opcoes = Array.isArray(s.opcoes) ? s.opcoes.map(String) : [];
  const comum = { ...base, numero: Number(s.numero ?? 0), total: Number(s.total ?? 0), modelo: s.modelo ?? '', pergunta: s.pergunta, image_url: s.image_url, opcoes,
    total_respostas: Number(s.total_respostas ?? 0) };
  const passou = s.passou_ms == null ? 0 : Number(s.passou_ms);
  if (s.status === 'aberta' && passou < QUIZ_MS) {
    // Resposta certa nunca sai antes de a pergunta fechar.
    return { ...comum, fase: 'aberta', correta: null, restante_ms: Math.max(0, Math.round(QUIZ_MS - passou)), placar: [] };
  }
  const desdeFim = s.status === 'aberta' ? passou - QUIZ_MS : Number(s.fim_ms ?? s.atualizado_ms);
  if (desdeFim > QUIZ_REVELACAO_MS) return null;
  return { ...comum, fase: 'revelada', correta: s.correta, restante_ms: 0, placar: await placarQuiz(me, ano, s.question_id, s.status, 5) };
}

async function jogoEnquete(ano: number): Promise<JogoEnquete | null> {
  // Enquete esquecida aberta não prende a TV: vale se for recente ou se alguém votou há pouco.
  const { rows } = await query<{ id: number; pergunta: string; opcoes: unknown; aberta: boolean }>(
    `SELECT p.id, p.pergunta, p.opcoes, p.aberta FROM party_live_polls p
      WHERE p.ano = $1 AND (
        (p.aberta AND (p.created_at > NOW() - INTERVAL '45 minutes'
           OR EXISTS (SELECT 1 FROM party_live_poll_votes v WHERE v.poll_id = p.id AND v.updated_at > NOW() - INTERVAL '10 minutes')))
        OR (NOT p.aberta AND p.encerrada_em > NOW() - INTERVAL '25 seconds'))
      ORDER BY p.aberta DESC, p.created_at DESC, p.id DESC LIMIT 1`, [ano]);
  const poll = rows[0];
  if (!poll) return null;
  const votos = await query<{ opcao_index: number; total: number }>(
    'SELECT opcao_index, COUNT(*)::int AS total FROM party_live_poll_votes WHERE poll_id = $1 GROUP BY opcao_index', [poll.id]);
  const textos = Array.isArray(poll.opcoes) ? poll.opcoes.map(String) : [];
  const contagens = textos.map((_, i) => votos.rows.find((v) => v.opcao_index === i)?.total ?? 0);
  const total_votos = contagens.reduce((soma, v) => soma + v, 0);
  const maximo = Math.max(0, ...contagens);
  return { tipo: 'enquete', id: poll.id, pergunta: poll.pergunta, aberta: poll.aberta, total_votos,
    opcoes: textos.map((texto, i) => ({ texto, votos: contagens[i], percentual: total_votos ? Math.round((contagens[i] / total_votos) * 100) : 0,
      vencedora: !poll.aberta && maximo > 0 && contagens[i] === maximo })) };
}

async function jogoBingo(me: SessionUser, ano: number): Promise<JogoBingo | null> {
  const { rows } = await query<{ nome: string; padrao: string; status: string }>(
    `SELECT u.name AS nome, c.padrao, c.status FROM party_bingo_claims c JOIN family_users u ON u.id = c.user_id
      WHERE c.ano = $1 AND ${bloqueio('c.user_id', '$2')}
        AND ((c.status = 'pendente' AND c.created_at > NOW() - INTERVAL '3 minutes')
          OR (c.status = 'confirmado' AND c.confirmed_at > NOW() - INTERVAL '25 seconds'))
      ORDER BY (c.status = 'confirmado') DESC, c.created_at DESC LIMIT 4`, [ano, me.id]);
  const primeiro = rows[0];
  if (!primeiro) return null;
  return { tipo: 'bingo', confirmado: primeiro.status === 'confirmado', nome: primeiro.nome, padrao: primeiro.padrao, outros: rows.slice(1).map((r) => r.nome) };
}

async function jogoAmigo(): Promise<JogoAmigo | null> {
  const { live } = await loadLive();
  if (!live) return null;
  const agora = Date.now();
  if (live.encerrado_em) {
    if (agora - new Date(live.encerrado_em).getTime() > 90_000) return null;
  } else if (live.atual < 0 && agora - new Date(live.iniciado_em).getTime() > 15 * 60_000) {
    return null;
  }
  // loadLive só entrega pares já revelados (até o atual): o último é o da vez.
  const par = live.atual >= 0 ? live.pairs[live.atual] : undefined;
  return { tipo: 'amigo', atual: live.atual, total: live.total, encerrado: Boolean(live.encerrado_em), iniciado_em: new Date(live.iniciado_em).toISOString(),
    par: par ? { giver: par.giver, receiver: par.receiver, acertos: par.acertos } : null };
}

async function lerJogo(me: SessionUser, ano: number): Promise<Jogo | null> {
  const [bingo, amigo, quiz, enquete] = await Promise.all([
    jogoBingo(me, ano).catch((e) => { if (semTabela(e)) return null; throw e; }),
    jogoAmigo().catch((e) => { if (semTabela(e)) return null; throw e; }),
    jogoQuiz(me, ano).catch((e) => { if (semTabela(e)) return null; throw e; }),
    jogoEnquete(ano).catch((e) => { if (semTabela(e)) return null; throw e; }),
  ]);
  return bingo ?? amigo ?? quiz ?? enquete ?? null;
}

async function lerRecados(me: SessionUser, ano: number): Promise<Recado[]> {
  const { rows } = await query<{ id: number; nome: string; content: string | null; image_url: string | null; image_urls: string | null; created_at: string }>(
    `SELECT p.id, u.name AS nome, p.content, p.image_url, p.image_urls, (p.created_at AT TIME ZONE 'UTC')::text AS created_at
       FROM family_posts p JOIN family_users u ON u.id = p.user_id
      WHERE p.created_at >= $1::timestamp AND p.created_at < $2::timestamp AND ${bloqueio('p.user_id', '$3')}
        AND (NULLIF(btrim(p.content), '') IS NOT NULL OR NULLIF(p.image_url, '') IS NOT NULL OR NULLIF(p.image_urls, '') IS NOT NULL)
      ORDER BY p.created_at DESC, p.id DESC LIMIT 8`,
    [`${ano}-03-01`, `${ano + 1}-03-01`, me.id]);
  return rows.map((r) => {
    const texto = (r.content ?? '').trim().replace(/\s+/g, ' ');
    return { id: r.id, nome: r.nome, texto: texto.length > 240 ? `${texto.slice(0, 237).trimEnd()}...` : texto,
      foto: parsePostImages(r.image_urls, r.image_url)[0] ?? null, created_at: new Date(r.created_at).toISOString() };
  });
}

async function lerAdvento(ano: number): Promise<AdventoHoje | null> {
  const sit = situacaoAdvento();
  if (sit.diaDeHoje == null || sit.ano !== ano) return null;
  const base = padraoDoDia(sit.diaDeHoje);
  const { rows } = await query<{ tipo: string; titulo: string; texto: string | null; image_url: string | null; opcoes: unknown }>(
    'SELECT tipo, titulo, texto, image_url, opcoes FROM advent_windows WHERE ano = $1 AND dia = $2 LIMIT 1', [ano, sit.diaDeHoje]);
  const r = rows[0];
  const opcoesLinha = Array.isArray(r?.opcoes) ? r.opcoes.filter((o): o is string => typeof o === 'string' && o.trim() !== '') : null;
  return {
    dia: sit.diaDeHoje,
    tipo: r?.tipo || base.tipo,
    titulo: r?.titulo?.trim() || base.titulo,
    texto: r ? (r.texto ?? '').trim() : base.texto,
    image_url: r?.image_url || null,
    opcoes: (r?.tipo || base.tipo) === 'enquete' ? (opcoesLinha?.length ? opcoesLinha : base.opcoes) : null,
  };
}

async function lerPresentes(me: SessionUser): Promise<{ total: number; nomes: string[] }> {
  try {
    const { rows } = await query<{ nome: string }>(
      `SELECT u.name AS nome FROM family_daily_visits v JOIN family_users u ON u.id = v.user_id
        WHERE v.dia = $1::date AND ${bloqueio('v.user_id', '$2')} ORDER BY v.primeira, u.name`, [hojeSP(), me.id]);
    return { total: rows.length, nomes: rows.slice(0, 20).map((r) => r.nome) };
  } catch (e) {
    if (semTabela(e)) return { total: 0, nomes: [] };
    throw e;
  }
}

type Base = Omit<EstadoTelao, 'fotos' | 'recados' | 'advento' | 'placar' | 'presentes'>;
const cache = new Map<number, { em: number; promessa: Promise<Base> }>();

async function montarBase(me: SessionUser): Promise<Base> {
  const ano = edicaoAtual();
  const [controle, evento, marca, tocando, jogo] = await Promise.all([
    lerControle(ano), lerEvento(ano), lerMarca(ano), lerTocando(), lerJogo(me, ano),
  ]);
  return { agora: new Date().toISOString(), ano, meId: me.id, controle, evento, marca, tocando, jogo };
}

/** Parte leve (consultada a cada 3 s). Guardada por 2 s por pessoa: várias TVs e celulares não multiplicam as consultas. */
function base(me: SessionUser): Promise<Base> {
  const agora = Date.now();
  const guardado = cache.get(me.id);
  if (guardado && agora - guardado.em < 2000) return guardado.promessa;
  const promessa = montarBase(me);
  cache.set(me.id, { em: agora, promessa });
  if (cache.size > 50) for (const [id, v] of cache) if (agora - v.em > 10_000) cache.delete(id);
  promessa.catch(() => { if (cache.get(me.id)?.promessa === promessa) cache.delete(me.id); });
  return promessa;
}

/** Chamado depois de mexer no controle: a próxima leitura já vem atualizada. */
export function limparCacheTelao() { cache.clear(); }

export async function getEstado(me: SessionUser, inclui: ReadonlySet<Secao>): Promise<EstadoTelao> {
  const b = await base(me);
  const ano = b.ano;
  const [fotos, recados, advento, placar, presentes] = await Promise.all([
    inclui.has('fotos') ? getScreen(me).then((s) => s.fotos.slice(0, 60)) : undefined,
    inclui.has('recados') ? lerRecados(me, ano) : undefined,
    inclui.has('advento') ? lerAdvento(ano) : undefined,
    inclui.has('placar') ? placarQuiz(me, ano, null, 'preparando', 8).catch((e) => { if (semTabela(e)) return []; throw e; }) : undefined,
    inclui.has('presentes') ? lerPresentes(me) : undefined,
  ]);
  return { ...b, agora: new Date().toISOString(), ...(fotos && { fotos }), ...(recados && { recados }), ...(advento !== undefined && { advento }), ...(placar && { placar }), ...(presentes && { presentes }) };
}

