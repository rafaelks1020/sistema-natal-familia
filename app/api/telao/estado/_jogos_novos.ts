import 'server-only';
import { query } from '@/app/lib/db';
import type { SessionUser } from '@/app/lib/session';
import { ativoDe } from '@/app/api/festa/jogos-novos/_data';

// Jogos novos em tela grande (Mímica/Desenho, Quem é o bebê?, Roleta de prendas, Batalha de times).
// O integrador chama lerJogoNovo(me, ano) em _data.ts e junta o resultado ao tipo Jogo.
// A palavra da mímica NUNCA sai daqui: o telão só recebe quem joga, o time e o tempo.

export interface PlacarTime { nome: string; cor: string; pontos: number }

export type JogoNovo =
  | {
    tipo: 'mimica'; modo: 'mimica' | 'desenho'; quem: string; time: string; time_cor: string;
    restante_ms: number; duracao_ms: number; status: 'jogando' | 'acertou' | 'tempo'; placar_times: PlacarTime[];
  }
  | {
    tipo: 'bebe'; foto_url: string; total_votos: number; status: 'aberta' | 'revelada';
    resposta?: string; votos_por_pessoa?: { nome: string; votos: number }[];
  }
  | {
    tipo: 'roleta'; nomes: string[]; sorteado?: string; prenda?: string; girado_em?: string;
    /** Quanto tempo se passou desde o giro, medido pelo relógio do banco (evita depender da hora da TV). */
    girou_ha_ms?: number;
  }
  | { tipo: 'times'; times: { nome: string; cor: string; pontos: number; membros: string[] }[] };

const MIMICA_FIM_MS = 30_000;
const BEBE_ABERTA_MS = 60 * 60_000;
const BEBE_REVELADA_MS = 2 * 60_000;
const ROLETA_ESPERA_MS = 45 * 60_000;
const ROLETA_APOS_GIRO_MS = 2 * 60_000;
const TIMES_MS = 10 * 60_000;
const semTabela = (e: unknown) => (e as { code?: string } | null)?.code === '42P01';

async function placarTimes(ano: number): Promise<PlacarTime[]> {
  const { rows } = await query<PlacarTime>('SELECT nome, cor, pontos FROM party_teams WHERE ano = $1 ORDER BY pontos DESC, id', [ano]);
  return rows;
}

async function mimica(ano: number, id: number): Promise<JogoNovo | null> {
  const { rows } = await query<{
    modo: 'mimica' | 'desenho'; status: 'jogando' | 'acertou' | 'tempo'; duracao_s: number; quem: string | null;
    time: string | null; cor: string | null; restante_ms: number; fim_ms: number;
  }>(
    `SELECT m.modo, m.status, m.duracao_s, u.name AS quem, t.nome AS time, t.cor,
            (m.duracao_s * 1000 - EXTRACT(EPOCH FROM (COALESCE(m.encerrado_em, NOW()) - m.inicio)) * 1000)::float8 AS restante_ms,
            (EXTRACT(EPOCH FROM (NOW() - COALESCE(m.encerrado_em, m.inicio + m.duracao_s * interval '1 second'))) * 1000)::float8 AS fim_ms
       FROM party_mimica m LEFT JOIN family_users u ON u.id = m.quem_joga LEFT JOIN party_teams t ON t.id = m.team_id
      WHERE m.id = $1 AND m.ano = $2`, [id, ano]);
  const m = rows[0];
  if (!m) return null;
  const restante = Math.max(0, Math.round(Number(m.restante_ms)));
  const status = m.status === 'jogando' && restante <= 0 ? 'tempo' : m.status;
  if (status !== 'jogando' && Number(m.fim_ms) > MIMICA_FIM_MS) return null;
  return {
    tipo: 'mimica', modo: m.modo, quem: m.quem ?? '-', time: m.time ?? '', time_cor: m.cor ?? '#C5292D',
    restante_ms: status === 'jogando' ? restante : 0, duracao_ms: m.duracao_s * 1000, status, placar_times: await placarTimes(ano),
  };
}

async function bebe(id: number, idadeAtivoMs: number): Promise<JogoNovo | null> {
  const { rows } = await query<{ foto_url: string; status: 'aberta' | 'revelada'; resposta: string; total: number }>(
    `SELECT b.foto_url, b.status, r.name AS resposta, (SELECT COUNT(*)::int FROM party_bebe_votos v WHERE v.bebe_id = b.id) AS total
       FROM party_bebe b JOIN family_users r ON r.id = b.resposta_user_id WHERE b.id = $1`, [id]);
  const b = rows[0];
  if (!b) return null;
  if (idadeAtivoMs > (b.status === 'aberta' ? BEBE_ABERTA_MS : BEBE_REVELADA_MS)) return null;
  const base = { tipo: 'bebe' as const, foto_url: b.foto_url, total_votos: Number(b.total), status: b.status };
  if (b.status !== 'revelada') return base;
  const votos = await query<{ nome: string; votos: number }>(
    `SELECT u.name AS nome, COUNT(*)::int AS votos FROM party_bebe_votos v JOIN family_users u ON u.id = v.palpite_user_id
      WHERE v.bebe_id = $1 GROUP BY u.id, u.name ORDER BY votos DESC, u.name`, [id]);
  return { ...base, resposta: b.resposta, votos_por_pessoa: votos.rows };
}

async function roleta(id: number, idadeAtivoMs: number): Promise<JogoNovo | null> {
  const { rows } = await query<{
    participantes: unknown; girado_em: Date | null; sorteado: string | null; prenda: string | null; ha_ms: number | null;
  }>(
    `SELECT r.participantes, r.girado_em, u.name AS sorteado, r.prenda,
            (EXTRACT(EPOCH FROM (NOW() - r.girado_em)) * 1000)::float8 AS ha_ms
       FROM party_roleta r LEFT JOIN family_users u ON u.id = r.sorteado_user_id WHERE r.id = $1`, [id]);
  const r = rows[0];
  if (!r) return null;
  const girada = r.girado_em != null && r.sorteado != null;
  if (girada ? Number(r.ha_ms) > ROLETA_APOS_GIRO_MS : idadeAtivoMs > ROLETA_ESPERA_MS) return null;
  const ids = Array.isArray(r.participantes) ? r.participantes.map(Number).filter((n) => Number.isInteger(n)) : [];
  let nomes: string[];
  if (ids.length) {
    const lista = await query<{ id: number; nome: string }>('SELECT id, name AS nome FROM family_users WHERE id = ANY($1::int[])', [ids]);
    nomes = ids.map((i) => lista.rows.find((u) => u.id === i)?.nome).filter((n): n is string => Boolean(n));
  } else {
    // Antes do primeiro giro, a roda mostra quem está na festa hoje.
    const lista = await query<{ nome: string }>(
      `SELECT u.name AS nome FROM family_daily_visits v JOIN family_users u ON u.id = v.user_id
        WHERE v.dia = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date ORDER BY u.name LIMIT 24`).catch((e) => {
      if (semTabela(e)) return { rows: [] as { nome: string }[] };
      throw e;
    });
    nomes = lista.rows.map((u) => u.nome);
    if (nomes.length < 2) {
      nomes = (await query<{ nome: string }>('SELECT name AS nome FROM family_users ORDER BY name LIMIT 24')).rows.map((u) => u.nome);
    }
  }
  if (girada && r.sorteado && !nomes.includes(r.sorteado)) nomes.push(r.sorteado);
  if (!girada) return { tipo: 'roleta', nomes };
  return {
    tipo: 'roleta', nomes, sorteado: r.sorteado ?? undefined, prenda: r.prenda ?? undefined,
    girado_em: r.girado_em ? new Date(r.girado_em).toISOString() : undefined, girou_ha_ms: Math.max(0, Math.round(Number(r.ha_ms ?? 0))),
  };
}

async function times(ano: number, idadeAtivoMs: number): Promise<JogoNovo | null> {
  if (idadeAtivoMs > TIMES_MS) return null;
  const [lista, membros] = await Promise.all([
    query<{ id: number; nome: string; cor: string; pontos: number }>('SELECT id, nome, cor, pontos FROM party_teams WHERE ano = $1 ORDER BY id', [ano]),
    query<{ team_id: number; nome: string }>(
      'SELECT m.team_id, u.name AS nome FROM party_team_members m JOIN family_users u ON u.id = m.user_id WHERE m.ano = $1 ORDER BY u.name', [ano]),
  ]);
  if (!lista.rows.length) return null;
  return { tipo: 'times', times: lista.rows.map((t) => ({ nome: t.nome, cor: t.cor, pontos: t.pontos, membros: membros.rows.filter((m) => m.team_id === t.id).map((m) => m.nome) })) };
}

/** Jogo novo em destaque agora, ou null. `me` fica na assinatura para filtros futuros (o telão roda logado como alguém da família). */
export async function lerJogoNovo(me: SessionUser, ano: number): Promise<JogoNovo | null> {
  void me;
  try {
    const ativo = await ativoDe(ano);
    if (!ativo) return null;
    if (ativo.jogo === 'times') return await times(ano, ativo.idade_ms);
    if (!ativo.ref_id) return null;
    if (ativo.jogo === 'mimica') return await mimica(ano, ativo.ref_id);
    if (ativo.jogo === 'bebe') return await bebe(ativo.ref_id, ativo.idade_ms);
    return await roleta(ativo.ref_id, ativo.idade_ms);
  } catch (e) {
    // Migração 034 ainda não aplicada: o telão segue sem os jogos novos.
    if (semTabela(e)) return null;
    throw e;
  }
}
