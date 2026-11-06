import 'server-only';
import { query } from '@/app/lib/db';
import { edicaoAtual, hojeSP } from '@/app/lib/edicao';
import type { SessionUser } from '@/app/lib/session';
import { PRENDAS_PADRAO } from './_palavras';
import type {
  BebePainel, JogoAtivoNome, JogosNovosPainel, MimicaPainel, PessoaLeve, RoletaPainel, StatusMimica, TimeFesta,
} from './_tipos';

export const CHAVE_PRENDAS = 'festa_roleta_prendas';
const semTabela = (e: unknown) => (e as { code?: string } | null)?.code === '42P01';

export async function lerPrendas(): Promise<string[]> {
  const { rows } = await query<{ value: string }>('SELECT value FROM app_settings WHERE key = $1', [CHAVE_PRENDAS]);
  try {
    const bruto: unknown = JSON.parse(rows[0]?.value ?? 'null');
    if (Array.isArray(bruto)) {
      const lista = bruto.filter((p): p is string => typeof p === 'string' && p.trim() !== '');
      if (lista.length) return lista;
    }
  } catch {
    /* valor inválido: volta para a lista padrão */
  }
  return [...PRENDAS_PADRAO];
}

/** Quem está na festa hoje (acessou o site). Se quase ninguém abriu o app ainda, cai para toda a família. */
export async function listarPresentes(): Promise<PessoaLeve[]> {
  try {
    const { rows } = await query<PessoaLeve>(
      `SELECT u.id, u.name AS nome FROM family_daily_visits v JOIN family_users u ON u.id = v.user_id
        WHERE v.dia = $1::date ORDER BY u.name`, [hojeSP()]);
    if (rows.length >= 2) return rows;
  } catch (e) {
    if (!semTabela(e)) throw e;
  }
  return listarTodos();
}

export async function listarTodos(): Promise<PessoaLeve[]> {
  const { rows } = await query<PessoaLeve>('SELECT id, name AS nome FROM family_users ORDER BY name');
  return rows;
}

export async function ativoDe(ano: number): Promise<{ jogo: JogoAtivoNome; ref_id: number | null; idade_ms: number } | null> {
  try {
    const { rows } = await query<{ jogo: JogoAtivoNome; ref_id: string | null; idade_ms: number }>(
      `SELECT jogo, ref_id, (EXTRACT(EPOCH FROM (NOW() - updated_at)) * 1000)::float8 AS idade_ms FROM party_jogo_ativo WHERE ano = $1`, [ano]);
    const r = rows[0];
    return r ? { jogo: r.jogo, ref_id: r.ref_id == null ? null : Number(r.ref_id), idade_ms: Number(r.idade_ms) } : null;
  } catch (e) {
    if (semTabela(e)) return null;
    throw e;
  }
}

export async function marcarAtivo(ano: number, jogo: JogoAtivoNome, refId: number | null) {
  await query(
    `INSERT INTO party_jogo_ativo (ano, jogo, ref_id, updated_at) VALUES ($1, $2, $3, NOW())
     ON CONFLICT (ano) DO UPDATE SET jogo = EXCLUDED.jogo, ref_id = EXCLUDED.ref_id, updated_at = NOW()`,
    [ano, jogo, refId]);
}

export async function lerTimes(ano: number): Promise<TimeFesta[]> {
  const [times, membros] = await Promise.all([
    query<{ id: number; nome: string; cor: string; pontos: number }>(
      'SELECT id, nome, cor, pontos FROM party_teams WHERE ano = $1 ORDER BY id', [ano]),
    query<{ team_id: number; id: number; nome: string }>(
      `SELECT m.team_id, u.id, u.name AS nome FROM party_team_members m JOIN family_users u ON u.id = m.user_id
        WHERE m.ano = $1 ORDER BY u.name`, [ano]),
  ]);
  return times.rows.map((t) => ({ ...t, membros: membros.rows.filter((m) => m.team_id === t.id).map((m) => ({ id: m.id, nome: m.nome })) }));
}

interface LinhaMimica {
  id: string; modo: 'mimica' | 'desenho'; status: StatusMimica; quem_joga: number | null; quem_nome: string | null;
  team_id: number | null; time_nome: string | null; duracao_s: number; palavra: string; restante_ms: number;
}

async function lerMimica(me: SessionUser, id: number): Promise<MimicaPainel | null> {
  const { rows } = await query<LinhaMimica>(
    `SELECT m.id, m.modo, m.status, m.quem_joga, u.name AS quem_nome, m.team_id, t.nome AS time_nome, m.duracao_s, m.palavra,
            (m.duracao_s * 1000 - EXTRACT(EPOCH FROM (COALESCE(m.encerrado_em, NOW()) - m.inicio)) * 1000)::float8 AS restante_ms
       FROM party_mimica m LEFT JOIN family_users u ON u.id = m.quem_joga LEFT JOIN party_teams t ON t.id = m.team_id
      WHERE m.id = $1`, [id]);
  const m = rows[0];
  if (!m) return null;
  const restante = Math.max(0, Math.round(Number(m.restante_ms)));
  const status: StatusMimica = m.status === 'jogando' && restante <= 0 ? 'tempo' : m.status;
  return {
    id: Number(m.id), modo: m.modo, status, quem_joga_id: m.quem_joga, quem_joga_nome: m.quem_nome ?? '-', team_id: m.team_id,
    time_nome: m.time_nome ?? '', restante_ms: status === 'jogando' ? restante : 0, duracao_s: m.duracao_s,
    palavra: status === 'jogando' && m.quem_joga === me.id ? m.palavra : null,
  };
}

async function lerBebe(me: SessionUser, id: number): Promise<BebePainel | null> {
  const { rows } = await query<{ id: string; foto_url: string; status: 'aberta' | 'revelada'; resposta_user_id: number; resposta_nome: string; total: number; meu: number | null }>(
    `SELECT b.id, b.foto_url, b.status, b.resposta_user_id, r.name AS resposta_nome,
            (SELECT COUNT(*)::int FROM party_bebe_votos v WHERE v.bebe_id = b.id) AS total,
            (SELECT v.palpite_user_id FROM party_bebe_votos v WHERE v.bebe_id = b.id AND v.user_id = $2) AS meu
       FROM party_bebe b JOIN family_users r ON r.id = b.resposta_user_id WHERE b.id = $1`, [id, me.id]);
  const b = rows[0];
  if (!b) return null;
  const revelada = b.status === 'revelada';
  const mostra = revelada || me.is_admin;
  const votos = revelada
    ? (await query<{ nome: string; votos: number }>(
      `SELECT u.name AS nome, COUNT(*)::int AS votos FROM party_bebe_votos v JOIN family_users u ON u.id = v.palpite_user_id
        WHERE v.bebe_id = $1 GROUP BY u.id, u.name ORDER BY votos DESC, u.name`, [id])).rows
    : [];
  return {
    id: Number(b.id), foto_url: b.foto_url, status: b.status, total_votos: Number(b.total), meu_palpite: b.meu,
    resposta_id: mostra ? b.resposta_user_id : null, resposta_nome: mostra ? b.resposta_nome : null, votos_por_pessoa: votos,
  };
}

async function lerRoleta(id: number): Promise<RoletaPainel | null> {
  const { rows } = await query<{ id: string; girado_em: Date | null; nome: string | null; prenda: string | null }>(
    `SELECT r.id, r.girado_em, u.name AS nome, r.prenda FROM party_roleta r LEFT JOIN family_users u ON u.id = r.sorteado_user_id WHERE r.id = $1`, [id]);
  const r = rows[0];
  if (!r) return null;
  return { id: Number(r.id), girada: r.girado_em != null, sorteado_nome: r.nome, prenda: r.prenda };
}

type Comum = {
  ativo: Awaited<ReturnType<typeof ativoDe>>;
  times: TimeFesta[];
  pessoas: PessoaLeve[];
  admin: { prendas: string[]; presentes: PessoaLeve[] } | null;
};
const cacheComum = new Map<string, { em: number; promessa: Promise<Comum> }>();
const COMUM_TTL_MS = 2000;

/** Parte igual para todo mundo (jogo ativo, times, lista de pessoas e dados do organizador). A palavra da mímica e o palpite ficam fora: são por usuário. */
async function lerComum(ano: number, souAdmin: boolean): Promise<Comum> {
  const ativo = await ativoDe(ano);
  const [times, pessoas, admin] = await Promise.all([
    lerTimes(ano),
    ativo?.jogo === 'bebe' || souAdmin ? listarTodos() : [],
    souAdmin ? Promise.all([lerPrendas(), listarPresentes()]).then(([prendas, presentes]) => ({ prendas, presentes })) : null,
  ]);
  return { ativo, times, pessoas, admin };
}

function comumGuardado(ano: number, souAdmin: boolean): Promise<Comum> {
  const chave = `${ano}:${souAdmin ? 'a' : 'u'}`;
  const agora = Date.now();
  const guardado = cacheComum.get(chave);
  if (guardado && agora - guardado.em < COMUM_TTL_MS) return guardado.promessa;
  const promessa = lerComum(ano, souAdmin);
  cacheComum.set(chave, { em: agora, promessa });
  promessa.catch(() => { if (cacheComum.get(chave)?.promessa === promessa) cacheComum.delete(chave); });
  return promessa;
}

/**
 * Tudo que a página do celular precisa, já filtrado por quem está olhando.
 * `usarCache` (só no GET de polling): a parte comum é reaproveitada por 2 s. Depois de uma ação (POST) vem sempre fresco.
 */
export async function carregarPainel(me: SessionUser, usarCache = false): Promise<JogosNovosPainel> {
  const ano = edicaoAtual();
  const souAdmin = Boolean(me.is_admin);
  const comum = await (usarCache ? comumGuardado(ano, souAdmin) : lerComum(ano, souAdmin));
  const { ativo, times, pessoas, admin } = comum;
  const [mimica, bebe, roleta] = await Promise.all([
    ativo?.jogo === 'mimica' && ativo.ref_id ? lerMimica(me, ativo.ref_id) : null,
    ativo?.jogo === 'bebe' && ativo.ref_id ? lerBebe(me, ativo.ref_id) : null,
    ativo?.jogo === 'roleta' && ativo.ref_id ? lerRoleta(ativo.ref_id) : null,
  ]);
  return { ano, ativo: ativo?.jogo ?? null, times, mimica, bebe, roleta, pessoas, admin };
}
