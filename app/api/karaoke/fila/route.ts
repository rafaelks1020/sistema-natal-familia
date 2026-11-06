import { route, ok, readJson, cleanText, toInt, HttpError, requireUser, requireAdmin } from '@/app/lib/api';
import { query, transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { dentroDoLimite } from '@/app/lib/limite';
import { lerFaixa, parseLrc, type LinhaLetra } from '../_lrclib';
import { buscarTermo, juntarVideos, melhorKaraoke, ordenarPorDuracao, type VideoKaraoke } from '../_youtube';
import { candidatosValidos, listarBloqueados, MAX_CANDIDATOS, trocarVideo } from '../_trocar';

export const dynamic = 'force-dynamic';

type Q = typeof query;

interface LinhaFila {
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
  nota: number | null;
  estrelas: number | null;
  faixa: string | null;
  artista: string | null;
  lrclib_id: number | string | null;
  letra: LinhaLetra[] | null;
  offset_ms: number;
  modo: 'letra' | 'video';
}

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
        if (/candidatos|videos_falhos|karaoke_videos_bloqueados/.test(msg)) throw new HttpError(503, 'Rode a migração 039');
        if (codigo === '42703' || /karaoke_ajustes/.test(msg)) throw new HttpError(503, 'Rode a migração 038');
        throw new HttpError(503, 'Rode a migração 036');
      }
      throw err;
    }
  };
}

function item(l: LinhaFila) {
  return { ...l, id: Number(l.id), lrclib_id: l.lrclib_id == null ? null : Number(l.lrclib_id) };
}

/** Estado completo do karaokê do ano: música atual, fila, últimas feitas e ranking da noite. */
async function estado(q: Q, ano: number, meuId: number, comLetra = false) {
  const [linhas, ranking, pessoas] = await Promise.all([
    q<LinhaFila>(
      `SELECT f.id, f.user_id, u.name AS nome, f.dueto_user_id, d.name AS dueto_nome, f.video_id, f.titulo, f.canal,
              f.duracao_s, f.miniatura, f.status, f.posicao, n.nota, n.estrelas,
              f.faixa, f.artista, f.lrclib_id, f.offset_ms, f.modo,
              CASE WHEN $2::boolean AND f.status = 'cantando' THEN f.letra END AS letra
         FROM karaoke_fila f
         JOIN family_users u ON u.id = f.user_id
         LEFT JOIN family_users d ON d.id = f.dueto_user_id
         LEFT JOIN karaoke_notas n ON n.fila_id = f.id
        WHERE f.ano = $1 AND f.status IN ('fila', 'cantando', 'feita')
        ORDER BY f.posicao, f.id`,
      [ano, comLetra],
    ),
    q<{ user_id: number; nome: string; melhor: number; media: number; cantadas: number }>(
      `SELECT u.id AS user_id, u.name AS nome, MAX(n.nota)::int AS melhor, ROUND(AVG(n.nota))::int AS media, COUNT(*)::int AS cantadas
         FROM karaoke_notas n
         JOIN karaoke_fila f ON f.id = n.fila_id
         JOIN family_users u ON u.id = f.user_id OR u.id = f.dueto_user_id
        WHERE f.ano = $1
        GROUP BY u.id, u.name
        ORDER BY melhor DESC, media DESC, cantadas DESC, u.name
        LIMIT 20`,
      [ano],
    ),
    q<{ id: number; nome: string }>('SELECT id, name AS nome FROM family_users WHERE id <> $1 ORDER BY name, id', [meuId]),
  ]);
  const todas = linhas.rows.map(item);
  const atual = todas.find((l) => l.status === 'cantando') ?? null;
  const fila = todas.filter((l) => l.status === 'fila');
  const feitas = todas.filter((l) => l.status === 'feita').reverse().slice(0, 10);
  const minhasPendentes = todas.filter((l) => (l.status === 'fila' || l.status === 'cantando') && l.user_id === meuId).length;
  return { ano, atual, fila, feitas, ranking: ranking.rows, pessoas: pessoas.rows, minhasPendentes, maxPendentes: MAX_PENDENTES };
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
  return ok(await estado(query, edicaoAtual(), me.id, comLetra));
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
  modo: 'letra' | 'video';
  /** Vídeos para trocar se o escolhido não tocar embutido (o primeiro é o escolhido). */
  candidatos: VideoKaraoke[];
}

const MIN_LINHAS_COM_TEXTO = 3;

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
  const body = await readJson<{ lrclib_id?: unknown; candidatos?: unknown; video_id?: unknown; titulo?: unknown; canal?: unknown; duracao_s?: unknown; dueto_user_id?: unknown }>(req);
  const dueto = body.dueto_user_id == null || body.dueto_user_id === '' ? null : toInt(body.dueto_user_id, 'dueto_user_id');
  if (dueto === me.id) throw new HttpError(400, 'Escolha outra pessoa para o dueto.');

  let escolha: Escolha;
  if (body.lrclib_id != null && body.lrclib_id !== '') {
    const lrclibId = toInt(body.lrclib_id, 'lrclib_id');
    if (!dentroDoLimite('karaoke-escolher', me.id, 6)) throw new HttpError(429, 'Muitos pedidos seguidos. Espere um minutinho e tente de novo.');
    // Confere o limite de músicas antes de gastar buscas na rede (a conferência valendo é a da transação, abaixo).
    const { rows: ja } = await query(`SELECT 1 FROM karaoke_fila WHERE ano = $1 AND user_id = $2 AND status IN ('fila', 'cantando')`, [ano, me.id]);
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
  const miniatura = `https://i.ytimg.com/vi/${escolha.videoId}/mqdefault.jpg`;

  await transaction(async (q) => {
    await q('SELECT pg_advisory_xact_lock(hashtext($1))', [`karaoke:${ano}`]);
    if (dueto !== null) {
      const { rows } = await q('SELECT 1 FROM family_users WHERE id = $1', [dueto]);
      if (!rows.length) throw new HttpError(400, 'Essa pessoa não está na família.');
    }
    const { rows: pend } = await q<{ video_id: string }>(
      `SELECT video_id FROM karaoke_fila WHERE ano = $1 AND user_id = $2 AND status IN ('fila', 'cantando')`,
      [ano, me.id],
    );
    if (pend.length >= MAX_PENDENTES) throw new HttpError(400, `Você já tem ${MAX_PENDENTES} músicas esperando. Espere uma delas para pedir outra.`);
    if (pend.some((p) => p.video_id === escolha.videoId)) throw new HttpError(400, 'Você já pediu essa música.');
    // Ajuste de tempo lembrado desse vídeo (feito pelo organizador em apresentações anteriores).
    const { rows: aj } = await q<{ offset_ms: number }>('SELECT offset_ms FROM karaoke_ajustes WHERE video_id = $1', [escolha.videoId]);
    const offset = escolha.modo === 'letra' ? (aj[0]?.offset_ms ?? 0) : 0;
    await q(
      `INSERT INTO karaoke_fila (ano, user_id, dueto_user_id, video_id, titulo, canal, duracao_s, miniatura, status, posicao, faixa, artista, lrclib_id, letra, offset_ms, modo, candidatos)
       SELECT $1, $2, $3, $4, $5, $6, $7, $8, 'fila', COALESCE(MAX(posicao), 0) + 1, $9, $10, $11, $12::jsonb, $13, $14, $15::jsonb FROM karaoke_fila WHERE ano = $1`,
      [ano, me.id, dueto, escolha.videoId, escolha.titulo, escolha.canal, escolha.duracao, miniatura, escolha.faixa, escolha.artista, escolha.lrclibId, escolha.letra ? JSON.stringify(escolha.letra) : null, offset, escolha.modo, JSON.stringify(escolha.candidatos)],
    );
  });
  return ok(await estado(query, ano, me.id), 201);
}));

export const PATCH = route(comMigracao(async (req) => {
  const me = await requireAdmin();
  const ano = edicaoAtual();
  const body = await readJson<{ id?: unknown; acao?: unknown; nota?: unknown; estrelas?: unknown; detalhes?: unknown; offset_ms?: unknown; video_id_falho?: unknown; codigo?: unknown }>(req);
  const acao = typeof body.acao === 'string' ? body.acao : '';
  const ACOES = ['subir', 'descer', 'pular', 'remover', 'comecar', 'terminar', 'offset', 'trocar_video'];
  if (!ACOES.includes(acao)) throw new HttpError(400, 'Ação inválida.');
  const id = body.id == null ? null : toInt(body.id);
  if (id === null && acao !== 'comecar' && acao !== 'terminar') throw new HttpError(400, 'Campo id inválido.');

  if (acao === 'trocar_video') {
    const falho = typeof body.video_id_falho === 'string' ? body.video_id_falho.trim() : '';
    await trocarVideo(ano, id as number, falho, Number(body.codigo));
    return ok(await estado(query, ano, me.id, true));
  }

  const pontuar: { v: { userIds: number[]; nota: number } | null } = { v: null };

  await transaction(async (q) => {
    await q('SELECT pg_advisory_xact_lock(hashtext($1))', [`karaoke:${ano}`]);

    if (acao === 'subir' || acao === 'descer') {
      const { rows } = await q<{ id: number | string }>(`SELECT id FROM karaoke_fila WHERE ano = $1 AND status = 'fila' ORDER BY posicao, id`, [ano]);
      const ids = rows.map((r) => Number(r.id));
      const i = ids.indexOf(id as number);
      if (i < 0) throw new HttpError(404, 'Essa música não está na fila.');
      const j = acao === 'subir' ? i - 1 : i + 1;
      if (j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      for (let k = 0; k < ids.length; k++) await q('UPDATE karaoke_fila SET posicao = $1 WHERE id = $2', [k + 1, ids[k]]);
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
      const r = await q(`UPDATE karaoke_fila SET status = 'pulada', terminado_em = NOW() WHERE id = $1 AND ano = $2 AND status IN ('fila', 'cantando')`, [id, ano]);
      if (!r.rowCount) throw new HttpError(404, 'Essa música não está mais esperando.');
      return;
    }

    if (acao === 'remover') {
      const r = await q('DELETE FROM karaoke_fila WHERE id = $1 AND ano = $2', [id, ano]);
      if (!r.rowCount) throw new HttpError(404, 'Música não encontrada.');
      return;
    }

    if (acao === 'comecar') {
      let alvo = id;
      if (alvo === null) {
        const { rows } = await q<{ id: number | string }>(`SELECT id FROM karaoke_fila WHERE ano = $1 AND status = 'fila' ORDER BY posicao, id LIMIT 1`, [ano]);
        if (!rows.length) throw new HttpError(404, 'A fila está vazia.');
        alvo = Number(rows[0].id);
      }
      const { rows } = await q<{ status: string }>('SELECT status FROM karaoke_fila WHERE id = $1 AND ano = $2', [alvo, ano]);
      if (!rows.length) throw new HttpError(404, 'Música não encontrada.');
      if (rows[0].status === 'cantando') return;
      if (rows[0].status !== 'fila') throw new HttpError(400, 'Essa música já passou.');
      await q(`UPDATE karaoke_fila SET status = 'pulada', terminado_em = NOW() WHERE ano = $1 AND status = 'cantando'`, [ano]);
      await q(`UPDATE karaoke_fila SET status = 'cantando', iniciado_em = NOW() WHERE id = $1`, [alvo]);
      return;
    }

    // terminar
    let alvo = id;
    if (alvo === null) {
      const { rows } = await q<{ id: number | string }>(`SELECT id FROM karaoke_fila WHERE ano = $1 AND status = 'cantando' LIMIT 1`, [ano]);
      if (!rows.length) throw new HttpError(409, 'Não há música em andamento.');
      alvo = Number(rows[0].id);
    }
    const { rows } = await q<{ user_id: number; dueto_user_id: number | null }>(
      `UPDATE karaoke_fila SET status = 'feita', terminado_em = NOW() WHERE id = $1 AND ano = $2 AND status = 'cantando' RETURNING user_id, dueto_user_id`,
      [alvo, ano],
    );
    if (!rows.length) throw new HttpError(409, 'Essa apresentação já foi encerrada.');
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
