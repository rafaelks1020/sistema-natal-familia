import { HttpError } from '@/app/lib/api';
import { query, transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import type { SessionUser } from '@/app/lib/session';
import { classificarEliminatoria, classificarFinal, escolherFinalistas, ocultoPadrao } from '@/app/telao/karaoke/prova';
import { analisarSuspeita } from '@/app/telao/karaoke/prova-seguranca';
import type { ConfigProva, PainelProva, TentativaAdminProva, TentativaProva } from '@/app/telao/karaoke/prova-tipos';
import { estrelasEstudio, prepararNotas, type NotaEstudio, type Quadro } from '@/app/telao/karaoke/pontuacao';

export type Q = typeof query;
export async function travar(q: Q, ano: number) {
  // A mesma trava da fila livre evita duas apresentações simultâneas.
  await q('SELECT pg_advisory_xact_lock(hashtext($1))', [`karaoke:${ano}`]);
}
export function semCache<T>(resposta: T & { headers: Headers }): T {
  resposta.headers.set('Cache-Control', 'private, no-store');
  return resposta;
}
export async function configProva(q: Q, ano: number): Promise<ConfigProva | null> {
  const { rows } = await q<ConfigProva>('SELECT * FROM karaoke_prova WHERE ano = $1', [ano]);
  const c = rows[0];
  return c ? { ...c, musicas: c.musicas.map(Number), final_musica: c.final_musica == null ? null : Number(c.final_musica) } : null;
}
export async function carregarTentativas(q: Q, ano: number): Promise<TentativaProva[]> {
  const { rows } = await q<TentativaProva>(
    `SELECT id,user_id,catalogo_id,fase,fila_id,nota,detalhes - '_quadros' AS detalhes,status,iniciada_em,terminada_em
       FROM karaoke_prova_tentativas WHERE ano = $1 AND status <> 'anulada' ORDER BY iniciada_em,id`, [ano]);
  return rows.map((t) => ({ ...t, id: Number(t.id), fila_id: Number(t.fila_id), catalogo_id: Number(t.catalogo_id) }));
}
export async function classificacaoProva(q: Q, c: ConfigProva) {
  const tentativas = await carregarTentativas(q, c.ano);
  const { rows: pessoas } = await q<{ user_id: number; nome: string; avatar_url: string | null }>(
    `SELECT DISTINCT u.id AS user_id,u.name AS nome,u.avatar_url FROM family_users u
     JOIN karaoke_prova_tentativas t ON t.user_id = u.id WHERE t.ano = $1 AND t.status <> 'anulada'`, [c.ano]);
  const classificacao = classificarEliminatoria(c.musicas, tentativas, pessoas);
  const finalistas = escolherFinalistas(classificacao);
  return { tentativas, classificacao, finalistas, resultado: classificarFinal(finalistas, tentativas) };
}

/**
 * Consolida o último parcial persistido. Nunca libera uma nova tentativa.
 * Antes de descartar os quadros, confere a plausibilidade (detalhes.suspeita, só para a organização).
 */
export async function encerrarTentativa(q: Q, id: number, abandonada: boolean) {
  const { rows: antes } = await q<{ nota: number | null; detalhes: Record<string, unknown>; notas: NotaEstudio[] }>(
    `SELECT t.nota,t.detalhes,c.notas FROM karaoke_prova_tentativas t JOIN karaoke_catalogo c ON c.id = t.catalogo_id
      WHERE t.id = $1 AND t.status = 'cantando' FOR UPDATE OF t`, [id]);
  if (!antes[0]) return;
  const quadros = Array.isArray(antes[0].detalhes._quadros) ? antes[0].detalhes._quadros as Quadro[] : [];
  const suspeita = analisarSuspeita(quadros, prepararNotas(antes[0].notas), antes[0].nota ?? 0);
  const { rows } = await q<{ fila_id: string; nota: number | null; detalhes: Record<string, unknown>; fase: string }>(
    `UPDATE karaoke_prova_tentativas SET status = $2,nota = COALESCE(nota,0),terminada_em = NOW(),
      detalhes = (detalhes - '_quadros') || jsonb_build_object('abandonada',$3::boolean,'suspeita',$4::jsonb)
     WHERE id = $1 AND status = 'cantando' RETURNING fila_id,nota,detalhes,fase`, [id, abandonada ? 'abandonada' : 'valida', abandonada, JSON.stringify(suspeita)]);
  const t = rows[0];
  if (!t) return;
  // A cópia em karaoke_notas (lida pela fila livre e pelo placar) nunca leva a marca de suspeita.
  const { suspeita: _s, ...publicos } = t.detalhes;
  await q(`INSERT INTO karaoke_notas (fila_id,nota,estrelas,detalhes) VALUES ($1,$2,$3,$4::jsonb)
    ON CONFLICT (fila_id) DO UPDATE SET nota = EXCLUDED.nota,estrelas = EXCLUDED.estrelas,detalhes = EXCLUDED.detalhes`,
  [t.fila_id, t.nota ?? 0, estrelasEstudio(t.nota ?? 0), JSON.stringify({ ...publicos, prova: true, fase: t.fase, nivel: 'dificil' })]);
  await q(`UPDATE karaoke_fila SET status = 'feita',terminado_em = NOW(),parcial = $2 WHERE id = $1`, [t.fila_id, Math.round((t.nota ?? 0) * 100)]);
}

async function recuperar(q: Q, ano: number): Promise<number> {
  const { rows } = await q<{ id: string }>(`SELECT id FROM karaoke_prova_tentativas
    WHERE ano = $1 AND status = 'cantando' AND ultima_atividade_em < NOW() - INTERVAL '45 seconds' FOR UPDATE`, [ano]);
  for (const t of rows) await encerrarTentativa(q, Number(t.id), true);
  return rows.length;
}
/**
 * Encerra como abandonadas as tentativas sem contato há 45 s. Devolve quantas encerrou.
 * Dentro de uma transação já aberta (que tomou a trava com travar): recuperarInterrompidas(q, ano).
 * Sozinha, sem request (cron): recuperarInterrompidas() abre a própria transação no pool, toma a trava da fila e usa a
 * edição atual. Sem as tabelas da Prova (migração 047) não faz nada.
 */
export async function recuperarInterrompidas(q?: Q, ano: number = edicaoAtual()): Promise<number> {
  if (q) return recuperar(q, ano);
  try { return await transaction(async (tq) => { await travar(tq, ano); return recuperar(tq, ano); }); }
  catch (erro) {
    if (typeof erro === 'object' && erro && 'code' in erro && (erro.code === '42P01' || erro.code === '42703')) return 0;
    throw erro;
  }
}
/** Lista de conferência da organização: todas as tentativas, inclusive anuladas. */
export async function listarTentativasAdmin(q: Q, ano: number): Promise<TentativaAdminProva[]> {
  const { rows } = await q<Omit<TentativaAdminProva, 'id' | 'catalogo_id' | 'suspeita'> & { id: string; catalogo_id: string; suspeita: string[] | null }>(
    `SELECT t.id,t.user_id,u.name AS nome,t.catalogo_id,c.faixa AS musica,t.fase,t.nota,t.status,t.iniciada_em,
            t.detalhes->'suspeita' AS suspeita,t.detalhes->'anulacao'->>'motivo' AS motivo_anulacao,f.video_url
       FROM karaoke_prova_tentativas t JOIN family_users u ON u.id = t.user_id JOIN karaoke_catalogo c ON c.id = t.catalogo_id
       JOIN karaoke_fila f ON f.id = t.fila_id WHERE t.ano = $1 ORDER BY t.iniciada_em DESC,t.id DESC`, [ano]);
  return rows.map((r) => ({ ...r, id: Number(r.id), catalogo_id: Number(r.catalogo_id), suspeita: Array.isArray(r.suspeita) ? r.suspeita : [] }));
}
/** Tira dos detalhes o que só a organização pode ver. */
export function detalhesPublicos<T extends Record<string, unknown>>(d: T | null | undefined): Omit<T, 'suspeita' | 'anulacao'> {
  const { suspeita: _s, anulacao: _a, ...resto } = (d ?? {}) as T;
  return resto;
}
export async function painelProva(q: Q, me: SessionUser): Promise<PainelProva> {
  const ano = edicaoAtual();
  const c = await configProva(q, ano);
  const { rows: gami } = await q<{ ranking_oculto_em: Date; revelado_em: Date | null }>(
    'SELECT ranking_oculto_em,revelado_em FROM gami_config WHERE ano = $1', [ano]);
  const oculto = gami[0]?.ranking_oculto_em ?? ocultoPadrao(ano);
  const visivel = me.is_admin || Date.now() < new Date(oculto).getTime();
  const dados = c ? await classificacaoProva(q, c) : null;
  const { rows: musicas } = await q<{ id: string; faixa: string; artista: string }>(
    'SELECT id,faixa,artista FROM karaoke_catalogo WHERE id = ANY($1::bigint[]) ORDER BY array_position($1::bigint[],id)', [c?.musicas ?? []]);
  const pessoas = me.is_admin ? (await q<{ id: number; nome: string }>('SELECT id,name AS nome FROM family_users ORDER BY name,id')).rows : [];
  return {
    ano, eu: me.id, admin: me.is_admin, config: c, musicas: musicas.map((m) => ({ ...m, id: Number(m.id) })),
    minhas_tentativas: dados?.tentativas.filter((t) => t.user_id === me.id).map((t) => me.is_admin ? t : { ...t, detalhes: detalhesPublicos(t.detalhes) }) ?? [],
    classificacao: visivel ? dados?.classificacao ?? [] : null,
    finalistas: dados && (visivel || c?.status === 'final' || c?.status === 'encerrada')
      ? dados.finalistas.map(({ posicao,user_id,nome,avatar_url }) => ({ posicao,user_id,nome,avatar_url })) : null,
    resultado_final: me.is_admin || gami[0]?.revelado_em ? dados?.resultado ?? [] : null,
    ranking_oculto_em: new Date(oculto).toISOString(), pessoas,
    ...(me.is_admin && c ? { tentativas_admin: await listarTentativasAdmin(q, ano) } : {}),
  };
}
export function comMigracao<C = unknown>(h: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    try { return await h(req, ctx); }
    catch (erro) {
      if (typeof erro === 'object' && erro && 'code' in erro && (erro.code === '42P01' || erro.code === '42703')) {
        throw new HttpError(503, 'A Prova aguarda as migrações 046 e 047. Avise quem organiza.');
      }
      throw erro;
    }
  };
}
