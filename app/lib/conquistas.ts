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
  coletarDadosEdicao,
  inspecionarEsquema,
  lerConfigInterna,
  tem,
} from '@/app/lib/gamificacao/motor';

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
  const cfg = await lerConfigInterna(ano, query, e);

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

  const coleta = await coletarDadosEdicao(query, e, ano, cfg.encerra_em);
  const pessoasVisiveis = coleta.usuarios.filter((u) => !bloqueados.has(Number(u.id)));
  if (!pessoasVisiveis.some((p) => Number(p.id) === userId)) {
    throw new HttpError(404, 'Pessoa não encontrada.');
  }

  const metricasAlvo = coleta.metricasPorUser.get(userId) ?? metricasVazias();

  const ganhasDoUsuario = new Map<string, string>();
  const contagemFamilia = new Map<string, number>();

  if (tem(e, 'gami_conquistas', 'ano', 'user_id', 'conquista_id', 'ganha_em')) {
    const { rows } = await query<{ user_id: number; conquista_id: string; ganha_em: Date | string }>(
      `SELECT user_id, conquista_id, ganha_em FROM gami_conquistas WHERE ano = $1`,
      [ano],
    );
    for (const r of rows) {
      const uid = Number(r.user_id);
      contagemFamilia.set(r.conquista_id, (contagemFamilia.get(r.conquista_id) ?? 0) + 1);
      if (uid === userId) {
        ganhasDoUsuario.set(
          r.conquista_id,
          r.ganha_em instanceof Date ? r.ganha_em.toISOString() : String(r.ganha_em),
        );
      }
    }
  }

  // Também reflete conquistas já alcançadas nas métricas atuais mesmo antes do próximo ciclo do motor.
  const agoraIso = new Date().toISOString();
  for (const [uid, m] of coleta.metricasPorUser) {
    for (const def of CATALOGO_CONQUISTAS) {
      if (conquistaAlcancada(def, m)) {
        if (uid === userId && !ganhasDoUsuario.has(def.id)) {
          ganhasDoUsuario.set(def.id, agoraIso);
        }
        if ((contagemFamilia.get(def.id) ?? 0) === 0) {
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
