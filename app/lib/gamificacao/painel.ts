import 'server-only';
import { after } from 'next/server';
import { classificacaoProva, configProva } from '@/app/api/karaoke/prova/_dados';
import { cleanText, HttpError, isBlobUrl, toInt } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { enviarPush } from '@/app/lib/push';
import type { SessionUser } from '@/app/lib/session';
import {
  CATALOGO_CONQUISTAS,
  metricasVazias,
  montarConquistasVistas,
} from './catalogo';
import {
  estadoMissao,
  horarioPermitidoPushSP,
  MAPA_MODELOS_MISSAO,
  MODELOS_MISSAO,
  validarConteudoMissao,
} from './missoes';
import {
  coletarDadosEdicaoCacheada,
  garantirRecalculoRecente,
  idsParticipantesCompeticao,
  inspecionarEsquema,
  invalidarCachesGamificacao,
  lerComCache,
  lerConfigInterna,
  recalcular,
  tem,
  type EsquemaBanco,
} from './motor';
import {
  agruparExtratoPorDia,
  configPadrao,
  edicaoEncerrada,
  montarRanking,
  rankingEstaOculto,
  REGRAS_VISTAS,
  somarPorOrigem,
} from './regras';
import type {
  AjusteVisto,
  ConfigGamificacao,
  Lancamento,
  LinhaRanking,
  Missao,
  Origem,
  PainelAdminGamificacao,
  PainelMissoes,
  PainelPontos,
  PerfilPontos,
  PessoaCompeticao,
  RespostaMissao,
  RevelacaoTelao,
  TipoMissao,
} from './tipos';

export interface LancamentoComRef extends Lancamento {
  ref: string;
}

function isoDe(valor: Date | string | null | undefined, padrao = ''): string {
  if (!valor) return padrao;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isFinite(d.getTime()) ? d.toISOString() : padrao;
}

/** Aceita ISO completo ou datetime-local de São Paulo (AAAA-MM-DDTHH:mm). */
export function lerDataHoraSPouISO(valor: unknown, campo: string): Date {
  if (typeof valor !== 'string' || !valor.trim()) {
    throw new HttpError(400, `Informe ${campo}.`);
  }
  const s = valor.trim();
  const localMatch = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(s);
  if (localMatch) {
    const [, a, m, d, hh, mm, ss] = localMatch;
    const dt = new Date(`${a}-${m}-${d}T${hh}:${mm}:${ss ?? '00'}-03:00`);
    if (!Number.isFinite(dt.getTime())) throw new HttpError(400, `Data inválida em ${campo}.`);
    return dt;
  }
  const dt = new Date(s);
  if (!Number.isFinite(dt.getTime())) throw new HttpError(400, `Data inválida em ${campo}.`);
  return dt;
}

const BASE_TTL_MS = 15_000;

export function carregarBaseRankingEConquistas(ano: number, e: EsquemaBanco) {
  return lerComCache(`base:${ano}`, BASE_TTL_MS, () => lerBaseRankingEConquistas(ano, e));
}

/** Recalcula sem nunca falhar a resposta (o dado já foi salvo). Os caches de leitura são descartados antes e depois. */
async function recalcularSemFalhar(ano: number): Promise<void> {
  invalidarCachesGamificacao();
  try {
    await recalcular(ano);
  } catch (err) {
    console.error('[gamificacao:recalcular]', err instanceof Error ? err.message : 'falha');
  } finally {
    invalidarCachesGamificacao();
  }
}

async function lerBaseRankingEConquistas(ano: number, e: EsquemaBanco) {
  const cfg = await lerConfigInterna(ano, query, e);
  const excluidosSet = new Set(cfg.excluidos.map(Number));
  const colAvatar = tem(e, 'family_users', 'avatar_url') ? 'avatar_url' : 'NULL::text AS avatar_url';
  const { rows: usuarios } = await query<{ id: number; name: string; avatar_url: string | null }>(
    `SELECT id, name, ${colAvatar} FROM family_users ORDER BY name, id`,
  );

  const totaisPorUser = new Map<number, number>();
  const lancamentosPorUser = new Map<number, LancamentoComRef[]>();

  if (tem(e, 'gami_lancamentos', 'ano', 'user_id', 'origem', 'regra', 'ref', 'pontos', 'descricao', 'ocorreu_em')) {
    const { rows: lancs } = await query<{
      user_id: number;
      origem: Origem;
      regra: string;
      ref: string;
      pontos: number;
      descricao: string;
      ocorreu_em: Date | string;
    }>(
      `SELECT user_id, origem, regra, ref, pontos, descricao, ocorreu_em
         FROM gami_lancamentos
        WHERE ano = $1
        ORDER BY ocorreu_em DESC, id DESC`,
      [ano],
    );
    for (const r of lancs) {
      const uid = Number(r.user_id);
      const pts = Number(r.pontos);
      totaisPorUser.set(uid, (totaisPorUser.get(uid) ?? 0) + pts);
      const lista = lancamentosPorUser.get(uid) ?? [];
      lista.push({
        regra: r.regra,
        ref: r.ref,
        origem: r.origem,
        pontos: pts,
        descricao: r.descricao,
        ocorreu_em: isoDe(r.ocorreu_em),
      });
      lancamentosPorUser.set(uid, lista);
    }
  }

  const ganhasPorUser = new Map<number, Map<string, string>>();
  const contagemFamilia = new Map<string, number>();
  const qtdConquistasPorUser = new Map<number, number>();

  if (tem(e, 'gami_conquistas', 'ano', 'user_id', 'conquista_id', 'ganha_em')) {
    const { rows: conqs } = await query<{
      user_id: number;
      conquista_id: string;
      ganha_em: Date | string;
    }>(
      `SELECT user_id, conquista_id, ganha_em FROM gami_conquistas WHERE ano = $1`,
      [ano],
    );
    for (const r of conqs) {
      const uid = Number(r.user_id);
      const mapa = ganhasPorUser.get(uid) ?? new Map<string, string>();
      mapa.set(r.conquista_id, isoDe(r.ganha_em));
      ganhasPorUser.set(uid, mapa);
      if (!excluidosSet.has(uid)) {
        contagemFamilia.set(r.conquista_id, (contagemFamilia.get(r.conquista_id) ?? 0) + 1);
      }
      qtdConquistasPorUser.set(uid, (qtdConquistasPorUser.get(uid) ?? 0) + 1);
    }
  }

  const ranking = montarRanking(
    usuarios.map((u) => ({ id: Number(u.id), nome: u.name, avatar_url: u.avatar_url })),
    totaisPorUser,
    qtdConquistasPorUser,
    excluidosSet,
  );

  return {
    cfg,
    excluidosSet,
    usuarios,
    totaisPorUser,
    lancamentosPorUser,
    ganhasPorUser,
    contagemFamilia,
    ranking,
  };
}

export async function montarPainelPontos(
  userId: number,
  opcoes?: { ano?: number; visaoAdmin?: boolean },
): Promise<PainelPontos> {
  const ano = opcoes?.ano ?? edicaoAtual();
  const agora = new Date();
  const e = await inspecionarEsquema();
  let base = await carregarBaseRankingEConquistas(ano, e);
  if (await garantirRecalculoRecente(ano, base.cfg.recalculado_em)) {
    base = await carregarBaseRankingEConquistas(ano, e);
  }

  const pessoaExiste = base.usuarios.some((u) => Number(u.id) === userId);
  if (!pessoaExiste) throw new HttpError(404, 'Pessoa não encontrada.');

  const coleta = await coletarDadosEdicaoCacheada(e, ano, base.cfg.encerra_em);
  const metricas = coleta.metricasPorUser.get(userId) ?? metricasVazias();
  const ganhasDoUser = base.ganhasPorUser.get(userId) ?? new Map<string, string>();
  const conquistas = montarConquistasVistas(metricas, ganhasDoUser, base.contagemFamilia);
  const conquistasGanhas = conquistas.filter((c) => c.ganha_em !== null).length;

  const meusLancamentosComRef = base.lancamentosPorUser.get(userId) ?? [];
  const meusLancamentos: Lancamento[] = opcoes?.visaoAdmin
    ? meusLancamentosComRef.map((l) => ({
        regra: l.regra,
        ref: l.ref,
        origem: l.origem,
        pontos: l.pontos,
        descricao: l.descricao,
        ocorreu_em: l.ocorreu_em,
      }))
    : meusLancamentosComRef.map((l) => ({
        regra: l.regra,
        origem: l.origem,
        pontos: l.pontos,
        descricao: l.descricao,
        ocorreu_em: l.ocorreu_em,
      }));

  const total = base.totaisPorUser.get(userId) ?? 0;
  const porOrigem = somarPorOrigem(meusLancamentos);
  const extrato = agruparExtratoPorDia(meusLancamentos);

  const oculto = !opcoes?.visaoAdmin && rankingEstaOculto(base.cfg, agora);
  const minhaLinha = base.ranking.find((l) => l.user_id === userId) ?? null;

  return {
    ano,
    agora: agora.toISOString(),
    encerra_em: base.cfg.encerra_em,
    ranking_oculto_em: base.cfg.ranking_oculto_em,
    encerrado: edicaoEncerrada(base.cfg, agora),
    revelado: Boolean(base.cfg.revelado_em),
    user_id: userId,
    total,
    por_origem: porOrigem,
    posicao: oculto ? null : (minhaLinha?.posicao ?? null),
    ranking: oculto ? null : base.ranking,
    extrato,
    conquistas,
    conquistas_ganhas: conquistasGanhas,
    conquistas_total: CATALOGO_CONQUISTAS.length,
    regras: REGRAS_VISTAS,
    atualizado_em: base.cfg.recalculado_em ?? agora.toISOString(),
  };
}

export async function montarPerfilPontos(
  viewerId: number,
  targetUserId: number,
  ano = edicaoAtual(),
): Promise<PerfilPontos> {
  const agora = new Date();
  const e = await inspecionarEsquema();

  if (viewerId !== targetUserId && tem(e, 'user_blocks', 'blocker_id', 'blocked_id')) {
    const { rows: blk } = await query(
      `SELECT 1 FROM user_blocks
        WHERE (blocker_id = $1 AND blocked_id = $2)
           OR (blocker_id = $2 AND blocked_id = $1)`,
      [viewerId, targetUserId],
    );
    if (blk.length > 0) throw new HttpError(404, 'Pessoa não encontrada.');
  }

  let base = await carregarBaseRankingEConquistas(ano, e);
  if (await garantirRecalculoRecente(ano, base.cfg.recalculado_em)) {
    base = await carregarBaseRankingEConquistas(ano, e);
  }
  const alvo = base.usuarios.find((u) => Number(u.id) === targetUserId);
  if (!alvo) throw new HttpError(404, 'Pessoa não encontrada.');

  const coleta = await coletarDadosEdicaoCacheada(e, ano, base.cfg.encerra_em);
  const metricas = coleta.metricasPorUser.get(targetUserId) ?? metricasVazias();
  const ganhasDoUser = base.ganhasPorUser.get(targetUserId) ?? new Map<string, string>();
  const conquistas = montarConquistasVistas(metricas, ganhasDoUser, base.contagemFamilia);

  const oculto = rankingEstaOculto(base.cfg, agora) || base.excluidosSet.has(targetUserId);
  return {
    user_id: Number(alvo.id),
    nome: alvo.name,
    avatar_url: alvo.avatar_url,
    total: oculto ? null : (base.totaisPorUser.get(targetUserId) ?? 0),
    conquistas,
  };
}

async function listarMissoesInterno(
  viewerId: number,
  incluirRecusadasDeTodos: boolean,
  ano: number,
  e: EsquemaBanco,
  encerraEm: string,
  agora: Date,
): Promise<Missao[]> {
  if (!tem(e, 'gami_missoes', 'id', 'ano', 'titulo', 'descricao', 'tipo', 'pontos', 'inicia_em', 'termina_em')) {
    return [];
  }

  const { rows: missoesRows } = await query<{
    id: string | number;
    titulo: string;
    descricao: string;
    tipo: TipoMissao;
    pontos: number;
    inicia_em: Date | string;
    termina_em: Date | string;
  }>(
    `SELECT id, titulo, descricao, tipo, pontos, inicia_em, termina_em
       FROM gami_missoes
      WHERE ano = $1
      ORDER BY inicia_em DESC, id DESC`,
    [ano],
  );

  const respostasPorMissao = new Map<number, RespostaMissao[]>();
  if (tem(e, 'gami_missoes_respostas', 'id', 'missao_id', 'user_id', 'texto', 'image_url', 'status', 'motivo_recusa', 'created_at')) {
    const filtroBloqueio = !incluirRecusadasDeTodos && tem(e, 'user_blocks', 'blocker_id', 'blocked_id')
      ? `AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $2 AND b.blocked_id = r.user_id)`
      : '';
    const params = filtroBloqueio ? [ano, viewerId] : [ano];
    const { rows: respRows } = await query<{
      id: string | number;
      missao_id: string | number;
      user_id: number;
      nome: string;
      avatar_url: string | null;
      texto: string | null;
      image_url: string | null;
      status: 'aprovada' | 'recusada';
      motivo_recusa: string | null;
      created_at: Date | string;
    }>(
      `SELECT r.id, r.missao_id, r.user_id, u.name AS nome, u.avatar_url,
              r.texto, r.image_url, r.status, r.motivo_recusa, r.created_at
         FROM gami_missoes_respostas r
         JOIN gami_missoes m ON m.id = r.missao_id
         JOIN family_users u ON u.id = r.user_id
        WHERE m.ano = $1 ${filtroBloqueio}
        ORDER BY r.created_at DESC, r.id DESC`,
      params,
    );
    for (const r of respRows) {
      const mid = Number(r.missao_id);
      const lista = respostasPorMissao.get(mid) ?? [];
      lista.push({
        id: Number(r.id),
        user_id: Number(r.user_id),
        nome: r.nome,
        avatar_url: r.avatar_url,
        texto: r.texto,
        image_url: r.image_url,
        status: r.status,
        motivo_recusa: r.motivo_recusa,
        created_at: isoDe(r.created_at),
        minha: Number(r.user_id) === viewerId,
      });
      respostasPorMissao.set(mid, lista);
    }
  }

  return missoesRows.map((m): Missao => {
    const id = Number(m.id);
    const ini = isoDe(m.inicia_em);
    const fim = isoDe(m.termina_em);
    const todas = respostasPorMissao.get(id) ?? [];
    const minha = todas.find((r) => r.minha) ?? null;
    const aprovadas = todas.filter((r) => r.status === 'aprovada');
    return {
      id,
      titulo: m.titulo,
      descricao: m.descricao,
      tipo: m.tipo,
      pontos: Number(m.pontos),
      inicia_em: ini,
      termina_em: fim,
      estado: estadoMissao(ini, fim, encerraEm, agora),
      minha_resposta: minha,
      respostas: incluirRecusadasDeTodos ? todas : aprovadas,
      total_respostas: aprovadas.length,
    };
  });
}

export async function montarPainelMissoes(
  me: SessionUser,
  ano = edicaoAtual(),
): Promise<PainelMissoes> {
  const agora = new Date();
  const e = await inspecionarEsquema();
  const cfg = await lerConfigInterna(ano, query, e);
  const todas = await listarMissoesInterno(me.id, me.is_admin, ano, e, cfg.encerra_em, agora);

  const ativas = todas.filter((m) => m.estado === 'ativa');
  const passadas = todas.filter((m) => m.estado === 'encerrada');
  const agendadas = me.is_admin
    ? todas.filter((m) => m.estado === 'agendada').sort((a, b) => Date.parse(a.inicia_em) - Date.parse(b.inicia_em))
    : [];

  return {
    ano,
    agora: agora.toISOString(),
    ativas,
    passadas,
    agendadas,
  };
}

export async function responderMissao(
  me: SessionUser,
  missaoId: number,
  corpo: Record<string, unknown>,
  ano = edicaoAtual(),
): Promise<PainelMissoes & { ok: true; resposta: RespostaMissao }> {
  const agora = new Date();
  const e = await inspecionarEsquema();
  if (!tem(e, 'gami_missoes', 'id', 'ano', 'tipo', 'inicia_em', 'termina_em')) {
    throw new HttpError(503, 'As missões ainda não estão ativas.');
  }

  const cfg = await lerConfigInterna(ano, query, e);
  if (edicaoEncerrada(cfg, agora)) {
    throw new HttpError(400, 'A pontuação desta edição já foi encerrada.');
  }

  const { rows: mRows } = await query<{
    id: number;
    ano: number;
    tipo: TipoMissao;
    inicia_em: Date | string;
    termina_em: Date | string;
  }>(
    `SELECT id, ano, tipo, inicia_em, termina_em FROM gami_missoes WHERE id = $1 AND ano = $2`,
    [missaoId, ano],
  );
  const missao = mRows[0];
  if (!missao) throw new HttpError(404, 'Missão não encontrada.');

  const estado = estadoMissao(isoDe(missao.inicia_em), isoDe(missao.termina_em), cfg.encerra_em, agora);
  if (estado === 'agendada') throw new HttpError(400, 'Esta missão ainda não começou.');
  if (estado === 'encerrada') throw new HttpError(400, 'O prazo desta missão já terminou.');

  const textoBruto = corpo.texto != null && typeof corpo.texto === 'string'
    ? cleanText(corpo.texto, 'a resposta', 1000, false)
    : null;
  const texto = textoBruto || null;

  let imageUrl: string | null = null;
  const imgRaw = corpo.image_url ?? corpo.foto_url;
  if (imgRaw !== undefined && imgRaw !== null && imgRaw !== '') {
    if (!isBlobUrl(imgRaw)) {
      throw new HttpError(400, 'Envie a foto pelo botão de upload do aplicativo.');
    }
    imageUrl = imgRaw.trim();
  }

  const erroConteudo = validarConteudoMissao(missao.tipo, texto, imageUrl);
  if (erroConteudo) throw new HttpError(400, erroConteudo);

  const { rows: salvas } = await query<{
    id: string | number;
    texto: string | null;
    image_url: string | null;
    status: 'aprovada' | 'recusada';
    motivo_recusa: string | null;
    created_at: Date | string;
  }>(
    `INSERT INTO gami_missoes_respostas (missao_id, user_id, texto, image_url, status, motivo_recusa, avaliado_por, created_at)
     VALUES ($1, $2, $3, $4, 'aprovada', NULL, NULL, NOW())
     ON CONFLICT (missao_id, user_id) DO UPDATE SET
       texto = CASE WHEN gami_missoes_respostas.status = 'recusada' THEN gami_missoes_respostas.texto ELSE EXCLUDED.texto END,
       image_url = CASE WHEN gami_missoes_respostas.status = 'recusada' THEN gami_missoes_respostas.image_url ELSE EXCLUDED.image_url END,
       status = CASE WHEN gami_missoes_respostas.status = 'recusada' THEN 'recusada' ELSE 'aprovada' END,
       motivo_recusa = CASE WHEN gami_missoes_respostas.status = 'recusada' THEN gami_missoes_respostas.motivo_recusa ELSE NULL END,
       avaliado_por = CASE WHEN gami_missoes_respostas.status = 'recusada' THEN gami_missoes_respostas.avaliado_por ELSE NULL END,
       created_at = CASE WHEN gami_missoes_respostas.status = 'recusada' THEN gami_missoes_respostas.created_at ELSE NOW() END
     RETURNING id, texto, image_url, status, motivo_recusa, created_at`,
    [missaoId, me.id, texto, imageUrl],
  );
  const r = salvas[0];
  if (r.status === 'recusada') {
    throw new HttpError(
      409,
      `Sua resposta foi recusada pela organização: ${r.motivo_recusa || 'fora das regras'}`,
    );
  }

  invalidarCachesGamificacao();
  try {
    after(() => recalcularSemFalhar(ano));
  } catch {
    await recalcularSemFalhar(ano);
  }

  const painel = await montarPainelMissoes(me, ano);
  const resposta: RespostaMissao = {
    id: Number(r.id),
    user_id: me.id,
    nome: me.name,
    avatar_url: me.avatar_url,
    texto: r.texto,
    image_url: r.image_url,
    status: r.status,
    motivo_recusa: r.motivo_recusa,
    created_at: isoDe(r.created_at),
    minha: true,
  };

  return { ...painel, ok: true, resposta };
}

export async function montarPainelAdminGamificacao(
  me: SessionUser,
  ano = edicaoAtual(),
): Promise<PainelAdminGamificacao> {
  await garantirRecalculoRecente(ano);
  const agora = new Date();
  const e = await inspecionarEsquema();
  const base = await carregarBaseRankingEConquistas(ano, e);

  const ajustes: AjusteVisto[] = [];
  if (tem(e, 'gami_ajustes', 'id', 'ano', 'user_id', 'pontos', 'motivo', 'anula_ref', 'criado_por', 'created_at')) {
    const { rows } = await query<{
      id: string | number;
      user_id: number;
      nome: string;
      pontos: number;
      motivo: string;
      anula_ref: string | null;
      criado_por_nome: string;
      created_at: Date | string;
    }>(
      `SELECT a.id, a.user_id, u.name AS nome, a.pontos, a.motivo, a.anula_ref,
              COALESCE(adm.name, 'Organização') AS criado_por_nome, a.created_at
         FROM gami_ajustes a
         JOIN family_users u ON u.id = a.user_id
         LEFT JOIN family_users adm ON adm.id = a.criado_por
        WHERE a.ano = $1
        ORDER BY a.created_at DESC, a.id DESC`,
      [ano],
    );
    for (const r of rows) {
      ajustes.push({
        id: Number(r.id),
        user_id: Number(r.user_id),
        nome: r.nome,
        pontos: Number(r.pontos),
        motivo: r.motivo,
        anula_ref: r.anula_ref,
        criado_por_nome: r.criado_por_nome,
        created_at: isoDe(r.created_at),
      });
    }
  }

  const missoes = await listarMissoesInterno(me.id, true, ano, e, base.cfg.encerra_em, agora);
  const config: ConfigGamificacao = {
    ano: base.cfg.ano,
    encerra_em: base.cfg.encerra_em,
    ranking_oculto_em: base.cfg.ranking_oculto_em,
    revelado_em: base.cfg.revelado_em,
    missoes_surpresa: base.cfg.missoes_surpresa,
    excluidos: base.cfg.excluidos,
  };

  const pessoas: PessoaCompeticao[] = base.usuarios.map((u) => ({
    id: Number(u.id),
    nome: u.name,
    avatar_url: u.avatar_url,
    excluido: base.excluidosSet.has(Number(u.id)),
  }));

  return {
    config,
    ranking: base.ranking,
    pessoas,
    ajustes,
    modelos: [...MODELOS_MISSAO],
    missoes,
    atualizado_em: base.cfg.recalculado_em ?? agora.toISOString(),
  };
}

export async function atualizarConfigGamificacao(
  me: SessionUser,
  corpo: Record<string, unknown>,
  ano = edicaoAtual(),
): Promise<PainelAdminGamificacao & { ok: true }> {
  const e = await inspecionarEsquema();
  if (!tem(e, 'gami_config', 'ano', 'encerra_em', 'ranking_oculto_em', 'missoes_surpresa')) {
    throw new HttpError(503, 'A tabela de configuração ainda não foi criada.');
  }

  const atual = await lerConfigInterna(ano, query, e);
  const encerra = corpo.encerra_em !== undefined
    ? lerDataHoraSPouISO(corpo.encerra_em, 'o horário de encerramento')
    : new Date(atual.encerra_em);
  const oculto = corpo.ranking_oculto_em !== undefined
    ? lerDataHoraSPouISO(corpo.ranking_oculto_em, 'o horário de ocultar o ranking')
    : new Date(atual.ranking_oculto_em);

  if (oculto.getTime() > encerra.getTime()) {
    throw new HttpError(400, 'O horário de ocultar o ranking não pode ser depois do encerramento.');
  }

  const missoesSurpresa = corpo.missoes_surpresa !== undefined
    ? Boolean(corpo.missoes_surpresa)
    : atual.missoes_surpresa;

  let reveladoEm: string | null = atual.revelado_em;
  if (corpo.revelado_em !== undefined) {
    reveladoEm = corpo.revelado_em === null || corpo.revelado_em === ''
      ? null
      : lerDataHoraSPouISO(corpo.revelado_em, 'o horário de revelação').toISOString();
  }

  let excluidos = atual.excluidos;
  if (corpo.excluidos !== undefined) {
    if (!Array.isArray(corpo.excluidos)) {
      throw new HttpError(400, 'A lista de excluídos deve ser um vetor de IDs.');
    }
    excluidos = [
      ...new Set(
        corpo.excluidos
          .map((x) => Number(x))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    ];
  }

  if (tem(e, 'gami_config', 'excluidos')) {
    await query(
      `INSERT INTO gami_config (ano, encerra_em, ranking_oculto_em, revelado_em, missoes_surpresa, excluidos, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::int[], NOW())
       ON CONFLICT (ano) DO UPDATE SET
         encerra_em = EXCLUDED.encerra_em,
         ranking_oculto_em = EXCLUDED.ranking_oculto_em,
         revelado_em = EXCLUDED.revelado_em,
         missoes_surpresa = EXCLUDED.missoes_surpresa,
         excluidos = EXCLUDED.excluidos,
         updated_at = NOW()`,
      [ano, encerra.toISOString(), oculto.toISOString(), reveladoEm, missoesSurpresa, excluidos],
    );
  } else {
    await query(
      `INSERT INTO gami_config (ano, encerra_em, ranking_oculto_em, revelado_em, missoes_surpresa, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (ano) DO UPDATE SET
         encerra_em = EXCLUDED.encerra_em,
         ranking_oculto_em = EXCLUDED.ranking_oculto_em,
         revelado_em = EXCLUDED.revelado_em,
         missoes_surpresa = EXCLUDED.missoes_surpresa,
         updated_at = NOW()`,
      [ano, encerra.toISOString(), oculto.toISOString(), reveladoEm, missoesSurpresa],
    );
  }

  await recalcularSemFalhar(ano);
  const painel = await montarPainelAdminGamificacao(me, ano);
  return { ...painel, ok: true };
}

export async function criarAjusteGamificacao(
  me: SessionUser,
  corpo: Record<string, unknown>,
  ano = edicaoAtual(),
): Promise<PainelAdminGamificacao & { ok: true; ajuste: AjusteVisto }> {
  const e = await inspecionarEsquema();
  if (!tem(e, 'gami_ajustes', 'id', 'ano', 'user_id', 'pontos', 'motivo', 'anula_ref', 'criado_por')) {
    throw new HttpError(503, 'A tabela de ajustes ainda não foi criada.');
  }

  const userId = toInt(corpo.user_id, 'pessoa');
  const { rows: uRows } = await query<{ id: number; name: string }>(
    `SELECT id, name FROM family_users WHERE id = $1`,
    [userId],
  );
  if (!uRows[0]) throw new HttpError(404, 'Pessoa não encontrada.');

  const motivo = cleanText(corpo.motivo, 'o motivo do ajuste', 240);
  const anulaRef = typeof corpo.anula_ref === 'string' && corpo.anula_ref.trim()
    ? cleanText(corpo.anula_ref, 'a referência a anular', 160)
    : null;

  const pontosInformados = corpo.pontos !== undefined && corpo.pontos !== null && corpo.pontos !== '';
  const pontosBrutos = !pontosInformados
    ? (anulaRef ? 0 : NaN)
    : Number(corpo.pontos);

  if (anulaRef && pontosBrutos !== 0) {
    throw new HttpError(400, 'Ao anular um lançamento, os pontos do ajuste devem ser 0.');
  }

  if (!Number.isInteger(pontosBrutos) || Math.abs(pontosBrutos) > 2000 || (!anulaRef && pontosBrutos === 0)) {
    throw new HttpError(400, 'Informe uma quantidade de pontos válida (diferente de zero).');
  }

  const { rows } = await query<{ id: string | number; created_at: Date | string }>(
    `INSERT INTO gami_ajustes (ano, user_id, pontos, motivo, anula_ref, criado_por)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, created_at`,
    [ano, userId, pontosBrutos, motivo, anulaRef, me.id],
  );

  await recalcularSemFalhar(ano);
  const painel = await montarPainelAdminGamificacao(me, ano);
  const ajuste: AjusteVisto = {
    id: Number(rows[0].id),
    user_id: userId,
    nome: uRows[0].name,
    pontos: pontosBrutos,
    motivo,
    anula_ref: anulaRef,
    criado_por_nome: me.name,
    created_at: isoDe(rows[0].created_at),
  };

  return { ...painel, ok: true, ajuste };
}

export async function removerAjusteGamificacao(
  me: SessionUser,
  id: number,
  ano = edicaoAtual(),
): Promise<PainelAdminGamificacao & { ok: true }> {
  const { rowCount } = await query(
    `DELETE FROM gami_ajustes WHERE id = $1 AND ano = $2`,
    [id, ano],
  );
  if (!rowCount) throw new HttpError(404, 'Ajuste não encontrado.');
  await recalcularSemFalhar(ano);
  const painel = await montarPainelAdminGamificacao(me, ano);
  return { ...painel, ok: true };
}

export async function criarMissaoAdmin(
  me: SessionUser,
  corpo: Record<string, unknown>,
  ano = edicaoAtual(),
): Promise<PainelAdminGamificacao & { ok: true; missao: Missao }> {
  const e = await inspecionarEsquema();
  if (!tem(e, 'gami_missoes', 'id', 'ano', 'titulo', 'descricao', 'tipo', 'pontos', 'inicia_em', 'termina_em')) {
    throw new HttpError(503, 'A tabela de missões ainda não foi criada.');
  }

  const modeloId = typeof corpo.modelo === 'string' && corpo.modelo.trim() ? corpo.modelo.trim() : null;
  const modeloBase = modeloId ? MAPA_MODELOS_MISSAO.get(modeloId) : undefined;
  if (modeloId && !modeloBase) {
    throw new HttpError(400, 'Modelo de missão não encontrado.');
  }

  const titulo = cleanText(corpo.titulo ?? modeloBase?.titulo, 'o título da missão', 120);
  const descricao = cleanText(corpo.descricao ?? modeloBase?.descricao, 'a descrição da missão', 500);

  const tipoRaw = (corpo.tipo ?? modeloBase?.tipo) as unknown;
  if (tipoRaw !== 'foto' && tipoRaw !== 'texto' && tipoRaw !== 'foto_texto') {
    throw new HttpError(400, 'Tipo de missão inválido (use foto, texto ou foto_texto).');
  }
  const tipo: TipoMissao = tipoRaw;

  const pontos = Number(corpo.pontos ?? modeloBase?.pontos ?? 40);
  if (!Number.isInteger(pontos) || pontos < 5 || pontos > 200) {
    throw new HttpError(400, 'Os pontos da missão devem ficar entre 5 e 200.');
  }

  const agora = new Date();
  const inicia = corpo.inicia_em
    ? lerDataHoraSPouISO(corpo.inicia_em, 'o início da missão')
    : agora;

  let termina: Date;
  if (corpo.termina_em) {
    termina = lerDataHoraSPouISO(corpo.termina_em, 'o término da missão');
  } else {
    const duracaoHoras = Number(corpo.duracao_horas ?? corpo.duracao_h ?? corpo.horas ?? 6);
    if (!Number.isFinite(duracaoHoras) || duracaoHoras <= 0 || duracaoHoras > 168) {
      throw new HttpError(400, 'Duração da missão inválida.');
    }
    termina = new Date(inicia.getTime() + Math.round(duracaoHoras * 3600 * 1000));
  }

  if (termina.getTime() <= inicia.getTime()) {
    throw new HttpError(400, 'O término da missão precisa ser depois do início.');
  }

  const jaComecou = inicia.getTime() <= agora.getTime() + 60_000 && termina.getTime() > agora.getTime();
  const enviarAgora = jaComecou && horarioPermitidoPushSP(agora);

  const { rows } = await query<{ id: string | number }>(
    `INSERT INTO gami_missoes (ano, modelo, titulo, descricao, tipo, pontos, inicia_em, termina_em, aviso_inicio_em, criado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      ano,
      modeloId,
      titulo,
      descricao,
      tipo,
      pontos,
      inicia.toISOString(),
      termina.toISOString(),
      enviarAgora ? agora.toISOString() : null,
      me.id,
    ],
  );
  const novoId = Number(rows[0].id);

  if (enviarAgora) {
    const ids = await idsParticipantesCompeticao(ano, e);
    if (ids.length > 0) {
      await enviarPush(ids, {
        titulo: `Missão relâmpago (+${pontos} pts)!`,
        corpo: titulo,
        rota: '/missoes',
      });
    }
  }

  const painel = await montarPainelAdminGamificacao(me, ano);
  const missao = painel.missoes.find((m) => m.id === novoId) ?? {
    id: novoId,
    titulo,
    descricao,
    tipo,
    pontos,
    inicia_em: inicia.toISOString(),
    termina_em: termina.toISOString(),
    estado: jaComecou ? 'ativa' : 'agendada',
    minha_resposta: null,
    respostas: [],
    total_respostas: 0,
  };

  return { ...painel, ok: true, missao };
}

export async function avaliarRespostaMissao(
  me: SessionUser,
  respostaId: number,
  corpo: Record<string, unknown>,
  ano = edicaoAtual(),
): Promise<PainelAdminGamificacao & { ok: true }> {
  const e = await inspecionarEsquema();
  if (!tem(e, 'gami_missoes_respostas', 'id', 'status', 'motivo_recusa', 'avaliado_por')) {
    throw new HttpError(503, 'A tabela de respostas ainda não foi criada.');
  }

  let status: 'aprovada' | 'recusada';
  if (corpo.status === 'aprovada' || corpo.aprovada === true) {
    status = 'aprovada';
  } else if (corpo.status === 'recusada' || corpo.aprovada === false) {
    status = 'recusada';
  } else {
    throw new HttpError(400, 'Informe se a resposta foi aprovada ou recusada.');
  }

  const motivo = status === 'recusada'
    ? cleanText(corpo.motivo_recusa ?? corpo.motivo, 'o motivo da recusa', 300)
    : null;

  const { rowCount } = await query(
    `UPDATE gami_missoes_respostas r
        SET status = $1,
            motivo_recusa = $2,
            avaliado_por = $3
       FROM gami_missoes m
      WHERE r.id = $4 AND m.id = r.missao_id AND m.ano = $5`,
    [status, motivo, me.id, respostaId, ano],
  );
  if (!rowCount) throw new HttpError(404, 'Resposta de missão não encontrada.');

  await recalcularSemFalhar(ano);
  const painel = await montarPainelAdminGamificacao(me, ano);
  return { ...painel, ok: true };
}

export async function revelarResultadoGamificacao(
  me: SessionUser,
  corpo?: Record<string, unknown>,
  ano = edicaoAtual(),
): Promise<PainelAdminGamificacao & { ok: true; revelado_em: string | null }> {
  const e = await inspecionarEsquema();
  if (!tem(e, 'gami_config', 'ano', 'revelado_em')) {
    throw new HttpError(503, 'A tabela de configuração ainda não foi criada.');
  }

  const desmarcar = corpo?.revelar === false || corpo?.ocultar === true;
  const padrao = configPadrao(ano);
  const { rows } = await query<{ revelado_em: Date | string | null }>(
    `INSERT INTO gami_config (ano, encerra_em, ranking_oculto_em, revelado_em, missoes_surpresa, updated_at)
     VALUES ($1, $2, $3, CASE WHEN $4::boolean THEN NULL ELSE NOW() END, $5, NOW())
     ON CONFLICT (ano) DO UPDATE SET
       revelado_em = CASE WHEN $4::boolean THEN NULL ELSE COALESCE(gami_config.revelado_em, NOW()) END,
       updated_at = NOW()
     RETURNING revelado_em`,
    [ano, padrao.encerra_em, padrao.ranking_oculto_em, desmarcar, padrao.missoes_surpresa],
  );

  await recalcularSemFalhar(ano);
  const painel = await montarPainelAdminGamificacao(me, ano);
  return {
    ...painel,
    ok: true,
    revelado_em: isoDe(rows[0]?.revelado_em) || null,
  };
}

export async function montarRevelacaoTelao(
  me: SessionUser,
  ano = edicaoAtual(),
): Promise<RevelacaoTelao> {
  const e = await inspecionarEsquema();
  if (!me.is_admin && tem(e, 'gami_config', 'ano', 'revelado_em')) {
    const { rows } = await query<{ revelado_em: Date | string | null }>(
      `SELECT revelado_em FROM gami_config WHERE ano = $1`,
      [ano],
    );
    if (!rows[0]?.revelado_em) return { revelado: false, campeao: [], prova: [] };
  }
  const base = await carregarBaseRankingEConquistas(ano, e);
  const revelado = Boolean(base.cfg.revelado_em);

  if (!revelado && !me.is_admin) {
    return { revelado: false, campeao: [], prova: [] };
  }

  const campeao: LinhaRanking[] = base.ranking.slice(0, 5);

  // Classificação oficial da Prova do Karaokê (app/api/karaoke/prova/_dados.ts).
  // Se a tabela não existir ou se a prova ainda não estiver encerrada, devolve lista vazia.
  let prova: RevelacaoTelao['prova'] = [];
  if (
    tem(e, 'karaoke_prova', 'ano', 'musicas', 'status')
    && tem(e, 'karaoke_prova_tentativas', 'id', 'ano', 'user_id', 'catalogo_id', 'fase', 'nota', 'status')
  ) {
    try {
      const cProva = await configProva(query, ano);
      if (cProva && cProva.status === 'encerrada') {
        const dadosProva = await classificacaoProva(query, cProva);
        prova = dadosProva.resultado
          .filter((item) => !base.excluidosSet.has(item.user_id))
          .map((item, idx) => ({
            posicao: idx + 1,
            user_id: item.user_id,
            nome: item.nome,
            avatar_url: item.avatar_url,
            nota_final: item.nota_final,
            soma_eliminatoria: item.soma_eliminatoria,
          }));
      }
    } catch {
      prova = [];
    }
  }

  return {
    revelado,
    campeao,
    prova,
  };
}
