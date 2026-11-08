import { route, ok, readJson, cleanText, toInt, HttpError, requireUser, requireAdmin } from '@/app/lib/api';
import { query, transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { dentroDoLimite } from '@/app/lib/limite';
import type { DadosEstudio, StatusCatalogo } from '@/app/telao/karaoke/tipos';
import { ordenarFilaJusta, type EntradaFilaJusta } from '@/app/telao/karaoke/fila-justa';
import { notasLinhasValidas, type CamposBatalhaFila } from '@/app/telao/karaoke/batalha';
import { lerFaixa, parseLrc, type LinhaLetra } from '../_lrclib';
import { buscarTermo, juntarVideos, melhorKaraoke, ordenarPorDuracao, type VideoKaraoke } from '../_youtube';
import { candidatosValidos, listarBloqueados, MAX_CANDIDATOS, trocarVideo } from '../_trocar';
import { ocultarNotasDaProva } from '../_oculto';

export const dynamic = 'force-dynamic';

type Q = typeof query;

interface LinhaFila extends CamposBatalhaFila {
  id: number | string;
  user_id: number;
  nome: string;
  dueto_user_id: number | null;
  dueto_nome: string | null;
  video_id: string;
  titulo: string;
  canal: string;
  duracao_s: number | null;
  miniatura: string | null;
  status: 'fila' | 'cantando' | 'feita' | 'pulada';
  posicao: number;
  prioridade_manual: number | null;
  nota: number | null;
  estrelas: number | null;
  faixa: string | null;
  artista: string | null;
  lrclib_id: number | string | null;
  letra: LinhaLetra[] | null;
  offset_ms: number;
  modo: 'estudio' | 'letra' | 'video';
  parcial: number | null;
  catalogo_id: number | string | null;
  catalogo_status: StatusCatalogo | null;
  capa_url: string | null;
  est_audio: string | null;
  est_palavras: DadosEstudio['palavras'] | null;
  est_notas: DadosEstudio['notas'] | null;
}

/** Apresentação ligada a uma tentativa oficial da Prova em andamento: a fila livre nunca mexe nela. */
const provaEmCurso = (coluna: string) => `EXISTS (SELECT 1 FROM karaoke_prova_tentativas pt WHERE pt.fila_id = ${coluna} AND pt.status = 'cantando')`;
const livreDaProva = (coluna: string) => `NOT ${provaEmCurso(coluna)}`;

const MAX_OFFSET_MS = 30_000;
const MAX_PENDENTES = 2;
const VIDEO_ID = /^[\w-]{11}$/;

function codigoPg(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null ? (err as { code?: string }).code : undefined;
}

/** Tabela ausente (42P01) ou coluna ausente (42703): avisa para rodar a migração em vez de dar erro 500. */
function comMigracao(h: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    try {
      return await h(req);
    } catch (err) {
      const codigo = codigoPg(err);
      const msg = err instanceof Error ? err.message : '';
      if (codigo === '42703' || codigo === '42P01') {
        if (/karaoke_prova/.test(msg)) throw new HttpError(503, 'Rode a migração 047');
        if (/prioridade_manual|batalha_|notas_linhas|karaoke_batalhas/.test(msg)) throw new HttpError(503, 'Rode a migração 044');
        if (/reel_|karaoke_momentos/.test(msg)) throw new HttpError(503, 'Rode a migração 042');
        if (/parcial/.test(msg)) throw new HttpError(503, 'Rode a migração 041');
        if (/catalogo/.test(msg)) throw new HttpError(503, 'Rode a migração 040');
        if (/candidatos|videos_falhos|karaoke_videos_bloqueados/.test(msg)) throw new HttpError(503, 'Rode a migração 039');
        if (codigo === '42703' || /karaoke_ajustes/.test(msg)) throw new HttpError(503, 'Rode a migração 038');
        throw new HttpError(503, 'Rode a migração 036');
      }
      throw err;
    }
  };
}

function item(l: LinhaFila) {
  const { est_audio, est_palavras, est_notas, ...resto } = l;
  const estudio = est_audio && est_palavras && est_notas ? { audio_url: est_audio, palavras: est_palavras, notas: est_notas } : null;
  return {
    ...resto, id: Number(l.id), lrclib_id: l.lrclib_id == null ? null : Number(l.lrclib_id),
    catalogo_id: l.catalogo_id == null ? null : Number(l.catalogo_id), estudio,
  };
}

/**
 * Estado completo do karaokê do ano: música atual, fila, últimas feitas e ranking da noite.
 * A tentativa oficial da Prova em andamento não aparece (outra tela a conduz). Com `ocultar` (família, enquanto o ranking da
 * Prova está oculto) as apresentações ligadas à Prova aparecem sem nota nem parcial e saem do ranking da noite.
 */
async function estado(q: Q, ano: number, meuId: number, comLetra = false, ocultar = false) {
  const [linhas, ranking, pessoas] = await Promise.all([
    q<LinhaFila>(
      `SELECT f.id, f.user_id, u.name AS nome, f.dueto_user_id, d.name AS dueto_nome, f.video_id, f.titulo, f.canal,
              f.duracao_s, f.miniatura, f.status, f.posicao,
              CASE WHEN $3::boolean AND pt.id IS NOT NULL THEN NULL ELSE n.nota END AS nota,
              CASE WHEN $3::boolean AND pt.id IS NOT NULL THEN NULL ELSE n.estrelas END AS estrelas,
              f.faixa, f.artista, f.lrclib_id, f.offset_ms, f.modo,
              CASE WHEN $3::boolean AND pt.id IS NOT NULL THEN NULL ELSE f.parcial END AS parcial, f.catalogo_id, c.status AS catalogo_status, c.capa_url,
              f.prioridade_manual, f.batalha_id, f.batalha_rodada, f.notas_linhas,
              CASE WHEN $2::boolean AND f.status = 'cantando' THEN f.letra END AS letra,
              CASE WHEN $2::boolean AND f.status = 'cantando' AND f.modo = 'estudio' AND c.status = 'pronta' THEN c.audio_url END AS est_audio,
              CASE WHEN $2::boolean AND f.status = 'cantando' AND f.modo = 'estudio' AND c.status = 'pronta' THEN c.palavras END AS est_palavras,
              CASE WHEN $2::boolean AND f.status = 'cantando' AND f.modo = 'estudio' AND c.status = 'pronta' THEN c.notas END AS est_notas
         FROM karaoke_fila f
         LEFT JOIN karaoke_catalogo c ON c.id = f.catalogo_id
         JOIN family_users u ON u.id = f.user_id
         LEFT JOIN family_users d ON d.id = f.dueto_user_id
         LEFT JOIN karaoke_notas n ON n.fila_id = f.id
         LEFT JOIN karaoke_prova_tentativas pt ON pt.fila_id = f.id
        WHERE f.ano = $1 AND f.status IN ('fila', 'cantando', 'feita') AND (pt.id IS NULL OR pt.status <> 'cantando')
        ORDER BY f.posicao, f.id`,
      [ano, comLetra, ocultar],
    ),
    q<{ user_id: number; nome: string; melhor: number; media: number; cantadas: number }>(
      `SELECT u.id AS user_id, u.name AS nome, MAX(n.nota)::int AS melhor, ROUND(AVG(n.nota))::int AS media, COUNT(*)::int AS cantadas
         FROM karaoke_notas n
         JOIN karaoke_fila f ON f.id = n.fila_id
         JOIN family_users u ON u.id = f.user_id OR u.id = f.dueto_user_id
        WHERE f.ano = $1
          AND NOT ($2::boolean AND EXISTS (SELECT 1 FROM karaoke_prova_tentativas pt WHERE pt.fila_id = f.id))
        GROUP BY u.id, u.name
        ORDER BY melhor DESC, media DESC, cantadas DESC, u.name
        LIMIT 20`,
      [ano, ocultar],
    ),
    q<{ id: number; nome: string }>('SELECT id, name AS nome FROM family_users WHERE id <> $1 ORDER BY name, id', [meuId]),
  ]);
  const todas = linhas.rows.map(item);
  const atual = todas.find((l) => l.status === 'cantando') ?? null;
  const fila = ordenarFilaJusta(linhas.rows).map(item);
  const feitas = todas.filter((l) => l.status === 'feita').reverse().slice(0, 10);
  // O pedido criado para o adversário de uma batalha (rodada 2) não conta no limite dele.
  const minhasPendentes = todas.filter((l) => (l.status === 'fila' || l.status === 'cantando') && l.user_id === meuId && l.batalha_rodada !== 2).length;
  return { ano, atual, fila, feitas, ranking: ranking.rows, pessoas: pessoas.rows, minhasPendentes, maxPendentes: MAX_PENDENTES };
}

/** A mesma ordem do GET, também para começar sem id e para os controles manuais. */
async function lerFilaOrdenada(q: Q, ano: number) {
  const { rows } = await q<EntradaFilaJusta>(
    `SELECT id, user_id, dueto_user_id, status, prioridade_manual, batalha_id, batalha_rodada
       FROM karaoke_fila WHERE ano = $1 AND status IN ('fila', 'cantando', 'feita') AND ${livreDaProva('karaoke_fila.id')}`, [ano],
  );
  return ordenarFilaJusta(rows);
}

/** Pontos para o time de quem cantou (tabelas opcionais: a migração dos times pode não existir). */
async function pontuarTimes(ano: number, userIds: number[], nota: number) {
  const pontos = Math.round(nota / 10);
  if (pontos <= 0 || !userIds.length) return;
  try {
    await query(
      `UPDATE party_teams SET pontos = pontos + $1
        WHERE ano = $2 AND id IN (SELECT team_id FROM party_team_members WHERE ano = $2 AND user_id = ANY($3::int[]))`,
      [pontos, ano, userIds],
    );
  } catch (err) {
    if (codigoPg(err) !== '42P01') console.error('[karaoke] pontos do time:', err);
  }
}

function numeroEntre(valor: unknown, min: number, max: number, campo: string): number {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, `Campo ${campo} inválido.`);
  return Math.round(n);
}

export const GET = route(comMigracao(async (req) => {
  const me = await requireUser();
  // A letra pesa alguns KB: só o telão pede (?letra=1), e só vem a da música que está cantando.
  const comLetra = new URL(req.url).searchParams.get('letra') === '1';
  const ano = edicaoAtual();
  return ok(await estado(query, ano, me.id, comLetra, await ocultarNotasDaProva(query, ano, me.is_admin)));
}));

interface Escolha {
  videoId: string;
  titulo: string;
  canal: string;
  duracao: number | null;
  faixa: string | null;
  artista: string | null;
  lrclibId: number | null;
  letra: LinhaLetra[] | null;
  modo: 'estudio' | 'letra' | 'video';
  /** Vídeos para trocar se o escolhido não tocar embutido (o primeiro é o escolhido). */
  candidatos: VideoKaraoke[];
}

const MIN_LINHAS_COM_TEXTO = 3;

/** Música do catálogo já pronta: entra na fila em modo estúdio, sem buscar vídeo no YouTube. */
function escolhaDeEstudio(c: { id: number | string; artista: string; faixa: string; duracao_ms: number | null; lrclib_id: number | string | null; capa_url: string | null }): Escolha {
  return {
    videoId: `estudio-${Number(c.id)}`,
    titulo: `${c.faixa} - ${c.artista}`.slice(0, 200),
    canal: 'Estúdio',
    duracao: c.duracao_ms ? Math.round(c.duracao_ms / 1000) : null,
    faixa: c.faixa,
    artista: c.artista,
    lrclibId: c.lrclib_id == null ? null : Number(c.lrclib_id),
    letra: null,
    modo: 'estudio',
    candidatos: [],
  };
}

/**
 * Pelo id do LRCLIB: lê a letra e procura o vídeo instrumental no YouTube com a duração da música (até 4 s de diferença).
 * Sem vídeo compatível, ou sem letra sincronizada, usa o melhor vídeo de karaokê e o modo 'video' (letra do próprio vídeo).
 */
async function escolherPorMusica(lrclibId: number, bloqueados: Set<string>): Promise<Escolha> {
  let faixa;
  try {
    faixa = await lerFaixa(lrclibId);
  } catch (err) {
    console.error('[karaoke] lrclib:', err);
    throw new HttpError(502, 'Não consegui buscar a letra agora. Tente de novo.');
  }
  if (!faixa) throw new HttpError(404, 'Música não encontrada.');
  const linhas = faixa.lrc ? parseLrc(faixa.lrc) : [];
  const temLetra = linhas.filter((l) => l.texto).length >= MIN_LINHAS_COM_TEXTO;

  const base = `${faixa.artista} ${faixa.faixa}`.trim();
  const buscas = await Promise.allSettled(['instrumental', 'playback', 'karaokê'].map((sufixo) => buscarTermo(`${base} ${sufixo}`)));
  const resultados = buscas.flatMap((b) => (b.status === 'fulfilled' ? [b.value] : []));
  if (!resultados.length) {
    console.error('[karaoke] youtube:', buscas.map((b) => (b.status === 'rejected' ? b.reason : null)).find(Boolean));
    throw new HttpError(502, 'Não consegui buscar no YouTube agora. Tente de novo em instantes.');
  }
  // Vídeos que o YouTube já recusou embutir não entram na escolha.
  const videos = juntarVideos(resultados).filter((v) => !bloqueados.has(v.video_id));

  const compativeis = temLetra && faixa.duracao_s ? ordenarPorDuracao(videos, faixa.duracao_s) : [];
  const video = compativeis[0] ?? melhorKaraoke(videos);
  if (!video) throw new HttpError(404, 'Não achei um vídeo de karaokê para essa música. Tente a busca de vídeo.');
  const letraNaTela = compativeis.length > 0;
  const candidatos = letraNaTela ? compativeis : [video, ...videos.filter((v) => v.video_id !== video.video_id)];
  return {
    videoId: video.video_id,
    titulo: `${faixa.faixa} - ${faixa.artista}`.slice(0, 200),
    canal: video.canal.slice(0, 120),
    duracao: video.duracao_s ?? faixa.duracao_s,
    faixa: faixa.faixa,
    artista: faixa.artista,
    lrclibId: faixa.id,
    letra: letraNaTela ? linhas : null,
    modo: letraNaTela ? 'letra' : 'video',
    candidatos: candidatos.slice(0, MAX_CANDIDATOS),
  };
}

export const POST = route(comMigracao(async (req) => {
  const me = await requireUser();
  const ano = edicaoAtual();
  const body = await readJson<{ catalogo_id?: unknown; lrclib_id?: unknown; candidatos?: unknown; video_id?: unknown; titulo?: unknown; canal?: unknown; duracao_s?: unknown; dueto_user_id?: unknown }>(req);
  const dueto = body.dueto_user_id == null || body.dueto_user_id === '' ? null : toInt(body.dueto_user_id, 'dueto_user_id');
  if (dueto === me.id) throw new HttpError(400, 'Escolha outra pessoa para o dueto.');

  let catalogoId: number | null = null;
  let capaCatalogo: string | null = null;
  let escolha: Escolha | null = null;
  if (body.catalogo_id != null && body.catalogo_id !== '') {
    catalogoId = toInt(body.catalogo_id, 'catalogo_id');
    const { rows } = await query<{ id: number | string; artista: string; faixa: string; duracao_ms: number | null; lrclib_id: number | string | null; capa_url: string | null; status: StatusCatalogo }>(
      'SELECT id, artista, faixa, duracao_ms, lrclib_id, capa_url, status FROM karaoke_catalogo WHERE id = $1', [catalogoId]);
    const cat = rows[0];
    if (!cat) throw new HttpError(404, 'Música do estúdio não encontrada.');
    capaCatalogo = cat.capa_url;
    if (cat.status === 'pronta') escolha = escolhaDeEstudio(cat);
    else if (body.lrclib_id == null || body.lrclib_id === '') throw new HttpError(409, 'A versão estúdio dessa música ainda não está pronta.');
  }
  if (escolha) {
    const { rows: ja } = await query(`SELECT 1 FROM karaoke_fila WHERE ano = $1 AND user_id = $2 AND status IN ('fila', 'cantando') AND batalha_rodada IS DISTINCT FROM 2`, [ano, me.id]);
    if (ja.length >= MAX_PENDENTES) throw new HttpError(400, `Você já tem ${MAX_PENDENTES} músicas esperando. Espere uma delas para pedir outra.`);
  } else if (body.lrclib_id != null && body.lrclib_id !== '') {
    const lrclibId = toInt(body.lrclib_id, 'lrclib_id');
    if (!dentroDoLimite('karaoke-escolher', me.id, 6)) throw new HttpError(429, 'Muitos pedidos seguidos. Espere um minutinho e tente de novo.');
    // Confere o limite de músicas antes de gastar buscas na rede (a conferência valendo é a da transação, abaixo).
    const { rows: ja } = await query(`SELECT 1 FROM karaoke_fila WHERE ano = $1 AND user_id = $2 AND status IN ('fila', 'cantando') AND batalha_rodada IS DISTINCT FROM 2`, [ano, me.id]);
    if (ja.length >= MAX_PENDENTES) throw new HttpError(400, `Você já tem ${MAX_PENDENTES} músicas esperando. Espere uma delas para pedir outra.`);
    escolha = await escolherPorMusica(lrclibId, await listarBloqueados());
  } else {
    const videoId = typeof body.video_id === 'string' ? body.video_id.trim() : '';
    if (!VIDEO_ID.test(videoId)) throw new HttpError(400, 'Vídeo inválido.');
    const escolhido: VideoKaraoke = {
      video_id: videoId,
      titulo: cleanText(body.titulo, 'o título', 200),
      canal: cleanText(body.canal, 'o canal', 120, false),
      duracao_s: body.duracao_s == null || body.duracao_s === '' ? null : numeroEntre(body.duracao_s, 1, 3 * 3600, 'duracao_s'),
      miniatura: '',
    };
    // O vídeo pedido primeiro, depois o resto dos resultados da busca (na ordem), sem os bloqueados.
    const bloqueados = await listarBloqueados();
    const lista = juntarVideos([[escolhido], candidatosValidos(body.candidatos)]).filter((v) => !bloqueados.has(v.video_id));
    if (!lista.length) throw new HttpError(400, 'Esse vídeo não pode ser tocado na TV. Escolha outro.');
    const primeiro = lista[0];
    escolha = {
      videoId: primeiro.video_id, titulo: primeiro.titulo, canal: primeiro.canal, duracao: primeiro.duracao_s,
      faixa: null, artista: null, lrclibId: null, letra: null, modo: 'video', candidatos: lista.slice(0, MAX_CANDIDATOS),
    };
  }
  const escolhaFinal: Escolha = escolha;
  const miniatura = escolhaFinal.modo === 'estudio' ? capaCatalogo : `https://i.ytimg.com/vi/${escolhaFinal.videoId}/mqdefault.jpg`;

  await transaction(async (q) => {
    await q('SELECT pg_advisory_xact_lock(hashtext($1))', [`karaoke:${ano}`]);
    if (dueto !== null) {
      const { rows } = await q('SELECT 1 FROM family_users WHERE id = $1', [dueto]);
      if (!rows.length) throw new HttpError(400, 'Essa pessoa não está na família.');
    }
    const { rows: pend } = await q<{ video_id: string; catalogo_id: number | string | null; batalha_rodada: number | null }>(
      `SELECT video_id, catalogo_id, batalha_rodada FROM karaoke_fila WHERE ano = $1 AND user_id = $2 AND status IN ('fila', 'cantando')`,
      [ano, me.id],
    );
    // O desafio recebido (rodada 2) não conta no limite, mas a música repetida continua barrada.
    if (pend.filter((p) => p.batalha_rodada !== 2).length >= MAX_PENDENTES) throw new HttpError(400, `Você já tem ${MAX_PENDENTES} músicas esperando. Espere uma delas para pedir outra.`);
    if (pend.some((p) => p.video_id === escolhaFinal.videoId || (catalogoId !== null && Number(p.catalogo_id) === catalogoId))) throw new HttpError(400, 'Você já pediu essa música.');
    // Ajuste de tempo lembrado desse vídeo (feito pelo organizador em apresentações anteriores).
    const { rows: aj } = await q<{ offset_ms: number }>('SELECT offset_ms FROM karaoke_ajustes WHERE video_id = $1', [escolhaFinal.videoId]);
    const offset = escolhaFinal.modo === 'letra' ? (aj[0]?.offset_ms ?? 0) : 0;
    await q(
      `INSERT INTO karaoke_fila (ano, user_id, dueto_user_id, video_id, titulo, canal, duracao_s, miniatura, status, posicao, faixa, artista, lrclib_id, letra, offset_ms, modo, candidatos, catalogo_id)
       SELECT $1, $2, $3, $4, $5, $6, $7, $8, 'fila', COALESCE(MAX(posicao), 0) + 1, $9, $10, $11, $12::jsonb, $13, $14, $15::jsonb, $16::bigint FROM karaoke_fila WHERE ano = $1`,
      [ano, me.id, dueto, escolhaFinal.videoId, escolhaFinal.titulo, escolhaFinal.canal, escolhaFinal.duracao, miniatura, escolhaFinal.faixa, escolhaFinal.artista, escolhaFinal.lrclibId, escolhaFinal.letra ? JSON.stringify(escolhaFinal.letra) : null, offset, escolhaFinal.modo, JSON.stringify(escolhaFinal.candidatos), catalogoId],
    );
  });
  return ok(await estado(query, ano, me.id, false, await ocultarNotasDaProva(query, ano, me.is_admin)), 201);
}));

export const PATCH = route(comMigracao(async (req) => {
  const me = await requireAdmin();
  const ano = edicaoAtual();
  const body = await readJson<{ id?: unknown; acao?: unknown; nota?: unknown; estrelas?: unknown; detalhes?: unknown; notas_linhas?: unknown; offset_ms?: unknown; video_id_falho?: unknown; codigo?: unknown; pontos?: unknown }>(req);
  const acao = typeof body.acao === 'string' ? body.acao : '';
  const ACOES = ['subir', 'descer', 'pular', 'remover', 'comecar', 'terminar', 'offset', 'trocar_video', 'parcial', 'reel'];
  if (!ACOES.includes(acao)) throw new HttpError(400, 'Ação inválida.');
  const id = body.id == null ? null : toInt(body.id);
  if (id === null && acao !== 'comecar' && acao !== 'terminar') throw new HttpError(400, 'Campo id inválido.');

  if (acao === 'parcial') {
    // Placar parcial do telão: resposta leve (não devolve o estado inteiro com a letra).
    const pontos = numeroEntre(body.pontos, 0, 10000, 'pontos');
    await query(`UPDATE karaoke_fila SET parcial = $1 WHERE id = $2 AND ano = $3 AND status = 'cantando' AND ${livreDaProva('karaoke_fila.id')}`, [pontos, id, ano]);
    return ok({ ok: true });
  }

  if (acao === 'reel') {
    // Fim da música com clipes enviados: pede ao worker o vídeo de melhores momentos. Não mexe em quem já está gerando ou pronto.
    const r = await query(
      `UPDATE karaoke_fila SET reel_status = 'pendente' WHERE id = $1 AND ano = $2 AND (reel_status IS NULL OR reel_status = 'falhou')`,
      [id, ano],
    );
    return ok({ ok: true, pendente: (r.rowCount ?? 0) > 0 });
  }

  if (acao === 'trocar_video') {
    const falho = typeof body.video_id_falho === 'string' ? body.video_id_falho.trim() : '';
    await trocarVideo(ano, id as number, falho, Number(body.codigo));
    return ok(await estado(query, ano, me.id, true));
  }

  const pontuar: { v: { userIds: number[]; nota: number } | null } = { v: null };

  await transaction(async (q) => {
    await q('SELECT pg_advisory_xact_lock(hashtext($1))', [`karaoke:${ano}`]);

    if (acao === 'subir' || acao === 'descer') {
      const fila = await lerFilaOrdenada(q, ano);
      const blocos: typeof fila[] = [];
      for (const entrada of fila) {
        const ultimo = blocos[blocos.length - 1];
        if (entrada.batalha_id && ultimo?.[0].batalha_id === entrada.batalha_id) ultimo.push(entrada);
        else blocos.push([entrada]);
      }
      const i = blocos.findIndex((bloco) => bloco.some((entrada) => Number(entrada.id) === id));
      if (i < 0) throw new HttpError(404, 'Essa música não está na fila.');
      const j = acao === 'subir' ? i - 1 : i + 1;
      if (j < 0 || j >= blocos.length) return;
      // A segunda apresentação de uma batalha iniciada precisa ser a próxima.
      if (blocos[i][0].batalha_rodada === 2 || blocos[j][0].batalha_rodada === 2) throw new HttpError(409, 'Termine a batalha antes de mudar essa posição.');
      [blocos[i], blocos[j]] = [blocos[j], blocos[i]];
      const ids = blocos.flat().map((entrada) => Number(entrada.id));
      // Registra a ordem inteira escolhida pelo organizador. Novos pedidos seguem as rodadas depois dela.
      await q(
        `UPDATE karaoke_fila f SET posicao = o.ordem::int, prioridade_manual = o.ordem::int
           FROM unnest($1::bigint[]) WITH ORDINALITY AS o(id, ordem) WHERE f.id = o.id AND f.ano = $2`, [ids, ano],
      );
      return;
    }

    if (acao === 'offset') {
      const offset = numeroEntre(body.offset_ms, -MAX_OFFSET_MS, MAX_OFFSET_MS, 'offset_ms');
      const { rows } = await q<{ video_id: string }>(`UPDATE karaoke_fila SET offset_ms = $1 WHERE id = $2 AND ano = $3 RETURNING video_id`, [offset, id, ano]);
      if (!rows.length) throw new HttpError(404, 'Música não encontrada.');
      await q(
        `INSERT INTO karaoke_ajustes (video_id, offset_ms, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (video_id) DO UPDATE SET offset_ms = EXCLUDED.offset_ms, updated_at = NOW()`,
        [rows[0].video_id, offset],
      );
      return;
    }

    if (acao === 'pular') {
      const { rows } = await q<{ batalha_id: string | null }>(`UPDATE karaoke_fila SET status = 'pulada', terminado_em = NOW() WHERE id = $1 AND ano = $2 AND status IN ('fila', 'cantando') AND ${livreDaProva('karaoke_fila.id')} RETURNING batalha_id`, [id, ano]);
      if (!rows.length) throw new HttpError(404, 'Essa música não está mais esperando.');
      if (rows[0].batalha_id) await q(`UPDATE karaoke_fila SET status = 'pulada', terminado_em = NOW() WHERE batalha_id = $1 AND ano = $2 AND status IN ('fila', 'cantando')`, [rows[0].batalha_id, ano]);
      return;
    }

    if (acao === 'remover') {
      const { rows } = await q<{ batalha_id: string | null }>('DELETE FROM karaoke_fila WHERE id = $1 AND ano = $2 AND NOT EXISTS (SELECT 1 FROM karaoke_prova_tentativas pt WHERE pt.fila_id = karaoke_fila.id) RETURNING batalha_id', [id, ano]);
      if (!rows.length) throw new HttpError(404, 'Música não encontrada.');
      if (rows[0].batalha_id) await q(`UPDATE karaoke_fila SET status = 'pulada', terminado_em = NOW() WHERE batalha_id = $1 AND ano = $2 AND status IN ('fila', 'cantando')`, [rows[0].batalha_id, ano]);
      return;
    }

    if (acao === 'comecar') {
      let alvo = id;
      if (alvo === null) {
        const fila = await lerFilaOrdenada(q, ano);
        if (!fila.length) throw new HttpError(404, 'A fila está vazia.');
        alvo = Number(fila[0].id);
      }
      const { rows } = await q<{ status: string }>('SELECT status FROM karaoke_fila WHERE id = $1 AND ano = $2', [alvo, ano]);
      if (!rows.length) throw new HttpError(404, 'Música não encontrada.');
      if (rows[0].status === 'cantando') return;
      if (rows[0].status !== 'fila') throw new HttpError(400, 'Essa música já passou.');
      const { rows: batalha } = await q<{ batalha_id: string | null; batalha_rodada: number | null }>('SELECT batalha_id, batalha_rodada FROM karaoke_fila WHERE id = $1', [alvo]);
      if (batalha[0]?.batalha_rodada === 2) {
        const { rows: primeira } = await q<{ status: string }>('SELECT status FROM karaoke_fila WHERE batalha_id = $1 AND batalha_rodada = 1', [batalha[0].batalha_id]);
        if (primeira[0]?.status !== 'feita') throw new HttpError(409, 'A primeira pessoa da batalha precisa cantar antes.');
      }
      // Não deixa uma seleção explícita interromper um duelo já iniciado.
      const fila = await lerFilaOrdenada(q, ano);
      if (fila[0]?.batalha_rodada === 2 && Number(fila[0].id) !== alvo) throw new HttpError(409, 'A segunda pessoa da batalha é a próxima.');
      await q(`UPDATE karaoke_fila SET status = 'pulada', terminado_em = NOW() WHERE ano = $1 AND status = 'cantando' AND ${livreDaProva('karaoke_fila.id')}`, [ano]);
      await q(`UPDATE karaoke_fila SET status = 'cantando', iniciado_em = NOW(), parcial = NULL WHERE id = $1`, [alvo]);
      // Versão estúdio ficou pronta enquanto esperava na fila: vira modo estúdio na hora de começar (o ajuste de tempo do vídeo não vale).
      await q(
        `UPDATE karaoke_fila SET modo = 'estudio', offset_ms = 0
          WHERE id = $1 AND modo <> 'estudio' AND catalogo_id IN (SELECT id FROM karaoke_catalogo WHERE status = 'pronta' AND audio_url IS NOT NULL AND palavras IS NOT NULL AND notas IS NOT NULL)`,
        [alvo],
      );
      return;
    }

    // terminar
    let alvo = id;
    if (alvo === null) {
      const { rows } = await q<{ id: number | string }>(`SELECT id FROM karaoke_fila WHERE ano = $1 AND status = 'cantando' AND ${livreDaProva('karaoke_fila.id')} LIMIT 1`, [ano]);
      if (!rows.length) throw new HttpError(409, 'Não há música em andamento.');
      alvo = Number(rows[0].id);
    }
    // notas_linhas só vale se bater com os trechos da batalha. Se não bater, a nota e o status são salvos do mesmo
    // jeito e as notas por linha são ignoradas: o organizador pode reenviar pelo PATCH da batalha.
    let notasLinhas: number[] | null = null;
    if (body.notas_linhas !== undefined) {
      if (!notasLinhasValidas(body.notas_linhas)) throw new HttpError(400, 'Envie notas_linhas como frações de 0 a 1.');
      const { rows: batalha } = await q<{ total: number }>(
        `SELECT jsonb_array_length(b.trechos) AS total FROM karaoke_batalhas b
           JOIN karaoke_fila f ON f.batalha_id = b.id WHERE f.id = $1 AND f.ano = $2`, [alvo, ano],
      );
      if (batalha.length && batalha[0].total !== body.notas_linhas.length) {
        console.warn('[karaoke] notas_linhas não batem com os trechos da batalha, ignoradas', alvo, batalha[0].total, body.notas_linhas.length);
      } else notasLinhas = body.notas_linhas;
    }
    const { rows } = await q<{ user_id: number; dueto_user_id: number | null }>(
      `UPDATE karaoke_fila SET status = 'feita', terminado_em = NOW() WHERE id = $1 AND ano = $2 AND status = 'cantando' AND ${livreDaProva('karaoke_fila.id')} RETURNING user_id, dueto_user_id`,
      [alvo, ano],
    );
    if (!rows.length) throw new HttpError(409, 'Essa apresentação já foi encerrada.');
    if (notasLinhas) await q('UPDATE karaoke_fila SET notas_linhas = $1::jsonb WHERE id = $2', [JSON.stringify(notasLinhas), alvo]);
    if (body.nota != null && body.estrelas != null) {
      const nota = numeroEntre(body.nota, 0, 100, 'nota');
      const estrelas = numeroEntre(body.estrelas, 1, 5, 'estrelas');
      let detalhes: string | null = null;
      if (body.detalhes != null) {
        if (typeof body.detalhes !== 'object' || Array.isArray(body.detalhes)) throw new HttpError(400, 'Campo detalhes inválido.');
        detalhes = JSON.stringify(body.detalhes);
        if (detalhes.length > 4000) throw new HttpError(400, 'Campo detalhes grande demais.');
      }
      await q(
        `INSERT INTO karaoke_notas (fila_id, nota, estrelas, detalhes) VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (fila_id) DO UPDATE SET nota = EXCLUDED.nota, estrelas = EXCLUDED.estrelas, detalhes = EXCLUDED.detalhes`,
        [alvo, nota, estrelas, detalhes],
      );
      const userIds = [rows[0].user_id, ...(rows[0].dueto_user_id ? [rows[0].dueto_user_id] : [])];
      pontuar.v = { userIds, nota };
    }
  });

  if (pontuar.v) await pontuarTimes(ano, pontuar.v.userIds, pontuar.v.nota);
  return ok(await estado(query, ano, me.id, true));
}));
