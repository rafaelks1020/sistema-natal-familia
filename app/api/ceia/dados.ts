import 'server-only';
import { getSettings } from '@/app/(app)/_inicio/server';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import type { SessionUser } from '@/app/lib/session';
import {
  categoriaDe,
  tipoDe,
  type CeiaDados,
  type CeiaOpcao,
  type CeiaPessoa,
  type CeiaPrato,
  type CeiaPresenca,
  type CeiaVotacao,
  type StatusPresenca,
} from './tipos';

type PessoaRow = {
  participant_id: number;
  name: string;
  avatar_url: string | null;
  status: string;
  adultos: number;
  criancas: number;
  restricao: string | null;
};

type PratoRow = {
  id: number;
  nome: string;
  categoria: string;
  quantidade: string | null;
  user_id: number;
  autor_nome: string;
  responsavel_id: number | null;
  responsavel_nome: string | null;
  created_at: Date | string;
};

type VotacaoRow = {
  id: number;
  pergunta: string;
  tipo: string;
  aberta: boolean;
  criado_por: number;
  created_at: Date | string;
  opcoes: unknown;
  meu_voto: number | null;
};

function isoDe(valor: Date | string): string {
  const data = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(data.getTime()) ? new Date().toISOString() : data.toISOString();
}

function statusDe(valor: string): StatusPresenca | null {
  return valor === 'yes' || valor === 'maybe' || valor === 'no' ? valor : null;
}

function opcoesDe(valor: unknown): CeiaOpcao[] {
  if (!Array.isArray(valor)) return [];
  const opcoes: CeiaOpcao[] = [];
  for (const item of valor) {
    if (!item || typeof item !== 'object') continue;
    const linha = item as Record<string, unknown>;
    const id = Number(linha.id);
    const votos = Number(linha.votos);
    if (!Number.isInteger(id) || id <= 0 || typeof linha.texto !== 'string' || !linha.texto) continue;
    opcoes.push({ id, texto: linha.texto, votos: Number.isInteger(votos) && votos > 0 ? votos : 0 });
  }
  return opcoes;
}

function mapearPrato(linha: PratoRow): CeiaPrato | null {
  const categoria = categoriaDe(linha.categoria);
  if (!categoria) return null;
  return {
    id: linha.id,
    nome: linha.nome,
    categoria,
    quantidade: linha.quantidade,
    user_id: linha.user_id,
    autor_nome: linha.autor_nome,
    responsavel_id: linha.responsavel_id,
    responsavel_nome: linha.responsavel_nome,
    created_at: isoDe(linha.created_at),
  };
}

function mapearVotacao(linha: VotacaoRow): CeiaVotacao | null {
  const tipo = tipoDe(linha.tipo);
  if (!tipo) return null;
  const opcoes = opcoesDe(linha.opcoes);
  const meu = linha.meu_voto === null || linha.meu_voto === undefined ? null : Number(linha.meu_voto);
  return {
    id: linha.id,
    pergunta: linha.pergunta,
    tipo,
    aberta: linha.aberta === true,
    criado_por: linha.criado_por,
    created_at: isoDe(linha.created_at),
    opcoes,
    meu_voto: meu !== null && Number.isInteger(meu) ? meu : null,
    total: opcoes.reduce((soma, opcao) => soma + opcao.votos, 0),
  };
}

const SQL_PRATOS = `
  SELECT d.id, d.nome, d.categoria, d.quantidade, d.user_id,
         autor.name AS autor_nome,
         d.responsavel_id, resp.name AS responsavel_nome,
         d.created_at
    FROM ceia_dishes d
    JOIN family_users autor ON autor.id = d.user_id
    LEFT JOIN family_users resp ON resp.id = d.responsavel_id
   WHERE d.ano = $1
     AND ($3::int IS NULL OR d.id = $3)
     AND NOT EXISTS (
       SELECT 1 FROM user_blocks b
        WHERE b.blocker_id = $2 AND b.blocked_id = d.user_id
     )
   ORDER BY d.nome, d.id`;

const SQL_VOTACOES = `
  SELECT v.id, v.pergunta, v.tipo, v.aberta, v.criado_por, v.created_at,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'id', o.id,
             'texto', o.texto,
             'votos', (SELECT COUNT(*)::int FROM ceia_votos vt WHERE vt.opcao_id = o.id)
           ) ORDER BY o.ordem, o.id)
             FROM ceia_votacao_opcoes o
            WHERE o.votacao_id = v.id
         ), '[]'::jsonb) AS opcoes,
         (SELECT vt.opcao_id FROM ceia_votos vt WHERE vt.votacao_id = v.id AND vt.user_id = $2) AS meu_voto
    FROM ceia_votacoes v
   WHERE v.ano = $1
     AND ($3::int IS NULL OR v.id = $3)
   ORDER BY v.aberta DESC, v.created_at DESC, v.id DESC`;

async function carregarPresenca(me: SessionUser, ano: number): Promise<CeiaPresenca> {
  const { rows } = await query<PessoaRow>(
    `SELECT a.participant_id, p.name, u.avatar_url, a.status,
            COALESCE(a.adultos, CASE WHEN a.status = 'no' THEN 0 ELSE 1 END)::int AS adultos,
            COALESCE(a.criancas, 0)::int AS criancas,
            CASE
              WHEN $2::bool OR a.user_id = $3 OR p.user_id = $3 THEN NULLIF(btrim(a.restricao), '')
              ELSE NULL
            END AS restricao
       FROM family_attendance a
       JOIN participants p ON p.id = a.participant_id
       LEFT JOIN family_users u ON u.id = p.user_id
      WHERE a.status IN ('yes', 'maybe', 'no')
        AND (a.ano IS NULL OR a.ano = $1)
      ORDER BY p.name, p.id`,
    [ano, me.is_admin, me.id],
  );
  const pessoas: CeiaPessoa[] = [];
  for (const linha of rows) {
    const status = statusDe(linha.status);
    if (!status) continue;
    pessoas.push({
      participant_id: linha.participant_id,
      name: linha.name,
      avatar_url: linha.avatar_url,
      status,
      adultos: linha.adultos,
      criancas: linha.criancas,
      restricao: linha.restricao,
    });
  }
  const confirmados = pessoas.filter((pessoa) => pessoa.status === 'yes');
  const adultos = confirmados.reduce((soma, pessoa) => soma + pessoa.adultos, 0);
  const criancas = confirmados.reduce((soma, pessoa) => soma + pessoa.criancas, 0);
  const minha = me.participant_id === null ? undefined : pessoas.find((pessoa) => pessoa.participant_id === me.participant_id);
  return {
    status: minha?.status ?? null,
    adultos: minha?.adultos ?? 1,
    criancas: minha?.criancas ?? 0,
    restricao: minha?.restricao ?? null,
    pessoas,
    totais: { confirmados: confirmados.length, adultos, criancas, pessoas: adultos + criancas },
  };
}

export async function carregarPratos(me: SessionUser, ano = edicaoAtual(), id: number | null = null): Promise<CeiaPrato[]> {
  const { rows } = await query<PratoRow>(SQL_PRATOS, [ano, me.id, id]);
  return rows.flatMap((linha) => {
    const prato = mapearPrato(linha);
    return prato ? [prato] : [];
  });
}

export async function carregarVotacoes(me: SessionUser, ano = edicaoAtual(), id: number | null = null): Promise<CeiaVotacao[]> {
  const { rows } = await query<VotacaoRow>(SQL_VOTACOES, [ano, me.id, id]);
  return rows.flatMap((linha) => {
    const votacao = mapearVotacao(linha);
    return votacao ? [votacao] : [];
  });
}

export async function carregarCeia(me: SessionUser): Promise<CeiaDados> {
  const ano = edicaoAtual();
  const [evento, presenca, pratos, votacoes] = await Promise.all([
    getSettings(),
    carregarPresenca(me, ano),
    carregarPratos(me, ano),
    carregarVotacoes(me, ano),
  ]);
  return { ano, evento, presenca, pratos, votacoes };
}

/** Mesma regra de PUT /api/settings: instante ISO com hora e fuso. */
export function dataEventoValida(valor: string): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(valor);
  const calendario = new Date(`${valor.slice(0, 10)}T00:00:00Z`);
  return Boolean(partes)
    && Number.isFinite(Date.parse(valor))
    && Number.isFinite(calendario.getTime())
    && calendario.toISOString().slice(0, 10) === valor.slice(0, 10);
}

