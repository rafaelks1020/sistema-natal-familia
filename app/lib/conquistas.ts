import 'server-only';
import { HttpError } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import {
  CATALOGO_CONQUISTAS,
  conquistaAlcancada,
  metricasVazias,
  montarConquistasVistas,
} from '@/app/lib/gamificacao/catalogo';
import {
  coletarDadosEdicaoCacheada,
  garantirRecalculoRecente,
  inspecionarEsquema,
  tem,
} from '@/app/lib/gamificacao/motor';
import { carregarBaseRankingEConquistas } from '@/app/lib/gamificacao/painel';

export interface Selo { id: string; nome: string; descricao: string; conquistado: boolean }
export interface Destaque { id: number; nome: string; avatar_url: string | null; total: number }
export interface Conquistas {
  ano: number;
  user_id: number;
  selos: Selo[];
  ranking: { id: string; titulo: string; pessoas: Destaque[] }[];
}

export async function carregarConquistas(viewerId: number, userId = viewerId): Promise<Conquistas> {
  const ano = edicaoAtual();
  const e = await inspecionarEsquema();
  let base = await carregarBaseRankingEConquistas(ano, e);
  if (await garantirRecalculoRecente(ano, base.cfg.recalculado_em)) {
    base = await carregarBaseRankingEConquistas(ano, e);
  }

  const bloqueados = new Set<number>();
  if (tem(e, 'user_blocks', 'blocker_id', 'blocked_id')) {
    const { rows: blk } = await query<{ id: number }>(
      `SELECT blocked_id AS id FROM user_blocks WHERE blocker_id = $1
       UNION
       SELECT blocker_id AS id FROM user_blocks WHERE blocked_id = $1`,
      [viewerId],
    );
    for (const r of blk) bloqueados.add(Number(r.id));
  }

  if (viewerId !== userId && bloqueados.has(userId)) {
    throw new HttpError(404, 'Pessoa não encontrada.');
  }

  const coleta = await coletarDadosEdicaoCacheada(e, ano, base.cfg.encerra_em);
  const pessoasVisiveis = base.usuarios.filter((u) => !bloqueados.has(Number(u.id)));
  if (!pessoasVisiveis.some((p) => Number(p.id) === userId)) {
    throw new HttpError(404, 'Pessoa não encontrada.');
  }

  const metricasAlvo = coleta.metricasPorUser.get(userId) ?? metricasVazias();
  const ganhasDoUsuario = new Map(base.ganhasPorUser.get(userId) ?? []);
  const contagemFamilia = new Map(base.contagemFamilia);

  // Também reflete conquistas já alcançadas nas métricas atuais mesmo antes do próximo ciclo do motor.
  const agoraIso = new Date().toISOString();
  for (const [uid, m] of coleta.metricasPorUser) {
    const participa = !base.excluidosSet.has(uid);
    for (const def of CATALOGO_CONQUISTAS) {
      if (conquistaAlcancada(def, m)) {
        if (uid === userId && !ganhasDoUsuario.has(def.id)) {
          ganhasDoUsuario.set(def.id, agoraIso);
        }
        if (participa && (contagemFamilia.get(def.id) ?? 0) === 0) {
          contagemFamilia.set(def.id, 1);
        }
      }
    }
  }

  const vistas = montarConquistasVistas(metricasAlvo, ganhasDoUsuario, contagemFamilia);
  const selos: Selo[] = vistas.map((c) => ({
    id: c.id,
    nome: c.nome,
    descricao: c.descricao,
    conquistado: c.ganha_em !== null,
  }));

  function top(extrator: (uid: number) => number): Destaque[] {
    return pessoasVisiveis
      .filter((p) => !base.excluidosSet.has(Number(p.id)))
      .map((p) => ({
        id: Number(p.id),
        nome: p.name,
        avatar_url: p.avatar_url,
        total: extrator(Number(p.id)),
      }))
      .filter((p) => p.total > 0)
      .sort((a, b) => b.total - a.total || a.id - b.id)
      .slice(0, 3);
  }

  return {
    ano,
    user_id: userId,
    selos,
    ranking: [
      { id: 'fotos', titulo: 'Paparazzi da família', pessoas: top((id) => coleta.metricasPorUser.get(id)?.fotos_total ?? 0) },
      { id: 'comentarios', titulo: 'Prosa que não acaba', pessoas: top((id) => coleta.metricasPorUser.get(id)?.comentarios ?? 0) },
      { id: 'coracoes', titulo: 'Chuva de carinho', pessoas: top((id) => coleta.metricasPorUser.get(id)?.reacoes_recebidas ?? 0) },
    ],
  };
}
