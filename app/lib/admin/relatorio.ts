import { calcularContas } from '@/app/api/contas-da-ceia/_calculo';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import type { PessoaRelatorio, RelatorioCeia } from './painel-tipos';
import { num } from './formato';
import { numerosVaquinha } from './numeros';

const CATEGORIAS = [
  ['salgado', 'Salgado'],
  ['doce', 'Doce'],
  ['bebida', 'Bebida'],
  ['descartavel', 'Descartável'],
  ['outro', 'Outro'],
] as const;

const DESLOCAMENTO = [
  ['carona_oferta', 'Oferece carona'],
  ['carona_pedido', 'Precisa de carona'],
  ['hospedagem_oferta', 'Oferece hospedagem'],
  ['hospedagem_pedido', 'Precisa de hospedagem'],
] as const;

function quandoEvento(valor: string): { data: string; hora: string } {
  const instante = new Date(valor);
  if (!Number.isFinite(instante.getTime())) return { data: 'Data a confirmar', hora: '' };
  return {
    data: instante.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    }),
    hora: instante.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }),
  };
}

function reservasDe(valor: unknown): { nome: string; quantidade: number }[] {
  if (!Array.isArray(valor)) return [];
  const lista: { nome: string; quantidade: number }[] = [];
  for (const item of valor) {
    if (!item || typeof item !== 'object') continue;
    const linha = item as Record<string, unknown>;
    if (typeof linha.nome !== 'string' || !linha.nome) continue;
    const quantidade = num(linha.quantidade);
    lista.push({ nome: linha.nome, quantidade: Number.isInteger(quantidade) && quantidade > 0 ? quantidade : 1 });
  }
  return lista;
}

function ints(valor: unknown): number[] {
  if (Array.isArray(valor)) return valor.map((n) => num(n)).filter((n) => Number.isInteger(n) && n > 0);
  return [];
}

export async function montarRelatorio(agora = new Date()): Promise<RelatorioCeia> {
  const ano = edicaoAtual(agora);
  const [ajustes, presenca, pratos, ofertas, pessoas, despesas, acertos, vaquinha, sorteio] = await Promise.all([
    query<{ key: string; value: string }>(
      `SELECT key, value FROM app_settings WHERE key = ANY($1::text[])`,
      [['event_title', 'event_date', 'event_place', 'amigo_tema']],
    ),
    query<{ nome: string; status: string; adultos: number; criancas: number; restricao: string | null }>(
      `SELECT p.name AS nome, a.status,
              COALESCE(a.adultos, CASE WHEN a.status = 'no' THEN 0 ELSE 1 END)::int AS adultos,
              COALESCE(a.criancas, 0)::int AS criancas,
              NULLIF(btrim(a.restricao), '') AS restricao
         FROM family_attendance a
         JOIN participants p ON p.id = a.participant_id
        WHERE a.status IN ('yes', 'maybe', 'no')
          AND (a.ano IS NULL OR a.ano = $1)
        ORDER BY p.name, p.id`,
      [ano],
    ),
    query<{ categoria: string; nome: string; quantidade: string | null; quem: string }>(
      `SELECT d.categoria, d.nome, NULLIF(btrim(d.quantidade), '') AS quantidade,
              COALESCE(resp.name, autor.name) AS quem
         FROM ceia_dishes d
         JOIN family_users autor ON autor.id = d.user_id
         LEFT JOIN family_users resp ON resp.id = d.responsavel_id
        WHERE d.ano = $1
        ORDER BY d.nome, d.id`,
      [ano],
    ),
    query<{ tipo: string; quem: string; origem: string; quando: string; vagas: number; observacao: string; telefone: string | null; reservas: unknown }>(
      `SELECT o.tipo, u.name AS quem, o.origem, o.quando, o.vagas, o.observacao,
              NULLIF(btrim(o.telefone), '') AS telefone,
              COALESCE((
                SELECT json_agg(json_build_object('nome', ru.name, 'quantidade', r.quantidade) ORDER BY ru.name)
                  FROM ride_reservations r
                  JOIN family_users ru ON ru.id = r.user_id
                 WHERE r.oferta_id = o.id
              ), '[]'::json) AS reservas
         FROM ride_offers o
         JOIN family_users u ON u.id = o.user_id
        WHERE o.ano = $1 AND o.ativo
        ORDER BY o.tipo, o.id`,
      [ano],
    ),
    query<{ id: number; name: string }>(`SELECT id, name FROM family_users ORDER BY id`),
    query<{ user_id: number; valor_centavos: number; partes: unknown }>(
      `SELECT d.user_id, d.valor_centavos,
              COALESCE((
                SELECT array_agg(p.user_id ORDER BY p.user_id)
                  FROM ceia_despesa_partes p WHERE p.despesa_id = d.id
              ), ARRAY[]::int[]) AS partes
         FROM ceia_despesas d
        WHERE d.ano = $1`,
      [ano],
    ),
    query<{ de_user_id: number; para_user_id: number; valor_centavos: number }>(
      `SELECT de_user_id, para_user_id, valor_centavos FROM ceia_acertos WHERE ano = $1`,
      [ano],
    ),
    numerosVaquinha(ano),
    // Só a contagem. Nunca traz giver_id, receiver_id nem token.
    query<{ participantes: number }>(
      `SELECT COUNT(*)::int AS participantes
         FROM secret_santa_draws d
        WHERE d.config_id = (
          SELECT c.id FROM secret_santa_config c
           WHERE c.is_active IS TRUE AND c.ano = $1
           ORDER BY c.id DESC
           LIMIT 1
        )`,
      [ano],
    ),
  ]);

  const valores = Object.fromEntries(ajustes.rows.map((r) => [r.key, r.value]));
  const quando = quandoEvento(valores.event_date ?? '');
  const grupo = (status: string): PessoaRelatorio[] => presenca.rows
    .filter((r) => r.status === status)
    .map((r) => ({
      nome: r.nome,
      adultos: num(r.adultos),
      criancas: num(r.criancas),
      restricao: r.restricao,
    }));
  const vou = grupo('yes');
  const nomes = new Map(pessoas.rows.map((p) => [p.id, p.name]));
  const lancamentos = despesas.rows.map((d) => ({
    user_id: num(d.user_id),
    valor_centavos: num(d.valor_centavos),
    partes: ints(d.partes),
  }));
  const pagos = acertos.rows.map((a) => ({
    de_user_id: num(a.de_user_id),
    para_user_id: num(a.para_user_id),
    valor_centavos: num(a.valor_centavos),
  }));
  const { saldos, transferencias } = calcularContas(pessoas.rows.map((p) => p.id), lancamentos, pagos);
  const nomeDe = (id: number) => nomes.get(id) ?? 'Alguém';

  return {
    ano,
    gerado_em: agora.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }),
    evento: {
      titulo: valores.event_title?.trim() || 'Ceia de Natal',
      data: quando.data,
      hora: quando.hora,
      local: valores.event_place?.trim() || '',
    },
    presenca: {
      vou,
      talvez: grupo('maybe'),
      nao: grupo('no'),
      adultos: vou.reduce((s, p) => s + p.adultos, 0),
      criancas: vou.reduce((s, p) => s + p.criancas, 0),
      pessoas: vou.reduce((s, p) => s + p.adultos + p.criancas, 0),
    },
    pratos: CATEGORIAS.map(([categoria, rotulo]) => ({
      categoria,
      rotulo,
      itens: pratos.rows
        .filter((p) => p.categoria === categoria)
        .map((p) => ({ nome: p.nome, quantidade: p.quantidade, quem: p.quem })),
    })).filter((g) => g.itens.length),
    deslocamento: DESLOCAMENTO.map(([tipo, rotulo]) => ({
      tipo,
      rotulo,
      itens: ofertas.rows
        .filter((o) => o.tipo === tipo)
        .map((o) => ({
          quem: o.quem,
          origem: o.origem,
          quando: o.quando,
          vagas: num(o.vagas),
          observacao: o.observacao,
          telefone: o.telefone,
          reservas: reservasDe(o.reservas),
        })),
    })).filter((g) => g.itens.length),
    contas: {
      total_centavos: lancamentos.reduce((s, d) => s + d.valor_centavos, 0),
      saldos: pessoas.rows
        .map((p) => ({ nome: p.name, saldo_centavos: saldos.get(p.id) ?? 0 }))
        .filter((p) => p.saldo_centavos !== 0)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      acertos: transferencias.map((t) => ({
        de: nomeDe(t.de_user_id),
        para: nomeDe(t.para_user_id),
        valor_centavos: t.valor_centavos,
      })),
    },
    vaquinha: {
      arrecadado_centavos: vaquinha.arrecadado_centavos,
      gasto_centavos: vaquinha.gasto_centavos,
      saldo_centavos: vaquinha.saldo_centavos,
    },
    amigo: {
      tema: (valores.amigo_tema || 'Livre').trim() || 'Livre',
      participantes: num(sorteio.rows[0]?.participantes),
    },
  };
}
