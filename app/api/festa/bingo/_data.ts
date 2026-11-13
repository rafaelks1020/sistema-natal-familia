import { query, transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import type { SessionUser } from '@/app/lib/session';

export const ITENS_PADRAO_BINGO: readonly string[] = [
  'Alguém derrubou bebida',
  'Tio contou a mesma piada',
  'Alguém dormiu no sofá',
  'Foto em grupo com alguém de olho fechado',
  'Criança abriu presente antes da hora',
  'Piada do pavê ou pacomê',
  'Discussão sobre uva-passa no arroz',
  'Vó insistiu para repetir o prato',
  'Perguntaram dos namoradinhos',
  'Alguém chegou mais de 1 hora atrasado',
  'Cachorro esperando comida embaixo da mesa',
  'Alguém pediu a senha do Wi-Fi',
  'Tentativa de foto que virou vídeo sem querer',
  'Parente mostrando vídeo antigo no celular',
  'Alguém disse que só começa a dieta em janeiro',
  'Criança correndo pela sala',
  'Faltou cadeira na mesa e buscaram banquinho',
  'Alguém trocou o nome dos sobrinhos',
  'Brinde com taça levantada bem alto',
  'Alguém elogiou o tempero do peru ou pernil',
  'Música da Simone tocou na caixa de som',
  'Alguém reclamou do calor',
  'Disputa pelo último pedaço de rabanada',
  'Alguém já separou potinho para levar sobra',
  'Abraço emocionado na chegada',
  'Alguém esqueceu onde deixou o copo',
  'História de Natal de quando era criança',
  'Alguém tirou o sapato debaixo da mesa',
  'Celular tocou alto no meio da conversa',
  'Dica misteriosa sobre o amigo oculto',
  'Alguém falou que o ano passou voando',
  'Briga amigável pelo controle do ventilador ou ar',
  'Alguém pediu para tirar mais uma foto porque saiu ruim',
  'Prato de sobremesa com três doces diferentes',
  'Alguém cantou junto uma música antiga',
  'Criança ficou acordada esperando a meia-noite',
  'Alguém contou uma conquista boa do ano',
  'Panetone de frutas versus chocotone na mesa',
  'Alguém deu risada alta da cozinha',
  'Parente ligou por chamada de vídeo para dar Feliz Natal',
  'Alguém tentou adivinhar o presente sacudindo a caixa',
  'Café passado depois da sobremesa',
  'Alguém falou que está cheio mas pegou mais um docinho',
  'Foto abraçado perto da árvore de Natal',
  'Brinde especial à meia-noite em ponto',
];

export const PADROES_BINGO: ReadonlyArray<{ nome: string; posicoes: readonly number[] }> = [
  { nome: 'Linha 1 (topo)', posicoes: [0, 1, 2, 3, 4] },
  { nome: 'Linha 2', posicoes: [5, 6, 7, 8, 9] },
  { nome: 'Linha 3 (centro)', posicoes: [10, 11, 12, 13, 14] },
  { nome: 'Linha 4', posicoes: [15, 16, 17, 18, 19] },
  { nome: 'Linha 5 (base)', posicoes: [20, 21, 22, 23, 24] },
  { nome: 'Coluna 1', posicoes: [0, 5, 10, 15, 20] },
  { nome: 'Coluna 2', posicoes: [1, 6, 11, 16, 21] },
  { nome: 'Coluna 3 (centro)', posicoes: [2, 7, 12, 17, 22] },
  { nome: 'Coluna 4', posicoes: [3, 8, 13, 18, 23] },
  { nome: 'Coluna 5', posicoes: [4, 9, 14, 19, 24] },
  { nome: 'Diagonal principal', posicoes: [0, 6, 12, 18, 24] },
  { nome: 'Diagonal secundária', posicoes: [4, 8, 12, 16, 20] },
];

export interface BingoCasa {
  posicao: number;
  item_id: number | null;
  texto: string;
  livre: boolean;
}

export interface BingoItemRow {
  id: number;
  texto: string;
  ativo: boolean;
}

export interface BingoClaimItem {
  id: number;
  user_id: number;
  user_name: string;
  avatar_url: string | null;
  padrao: string;
  posicoes: number[];
  frases: string[];
  status: 'pendente' | 'confirmado' | 'rejeitado';
  confirmed_by_name: string | null;
  created_at: string;
}

export interface BingoParticipanteProgresso {
  user_id: number;
  name: string;
  avatar_url: string | null;
  marcadas: number;
  tem_bingo: boolean;
}

export interface BingoData {
  ano: number;
  cartela: {
    id: number;
    casas: BingoCasa[];
    marcadas: number[];
    padroes_completos: Array<{ nome: string; posicoes: number[] }>;
    ja_gritou: boolean;
  };
  claims: BingoClaimItem[];
  participantes: BingoParticipanteProgresso[];
  itens: BingoItemRow[];
}

function embaralhar<T>(arr: readonly T[]): T[] {
  const copia = [...arr];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copia[i];
    copia[i] = copia[j];
    copia[j] = tmp;
  }
  return copia;
}

export function detectarPadroesCompletos(
  marcadasSet: ReadonlySet<number>,
): Array<{ nome: string; posicoes: number[] }> {
  const completos: Array<{ nome: string; posicoes: number[] }> = [];
  for (const p of PADROES_BINGO) {
    if (p.posicoes.every((pos) => pos === 12 || marcadasSet.has(pos))) {
      completos.push({ nome: p.nome, posicoes: [...p.posicoes] });
    }
  }
  return completos;
}

export function montarCasasSorteadas(itensAtivos: BingoItemRow[]): BingoCasa[] {
  let pool = embaralhar(itensAtivos);
  if (pool.length < 24) {
    const existentes = new Set(pool.map((x) => x.texto.toLowerCase()));
    const extras = embaralhar(
      ITENS_PADRAO_BINGO.filter((t) => !existentes.has(t.toLowerCase())).map((texto, idx) => ({
        id: -(idx + 1),
        texto,
        ativo: true,
      })),
    );
    pool = [...pool, ...extras];
  }
  const escolhidos = pool.slice(0, 24);
  const casas: BingoCasa[] = [];
  let cursor = 0;
  for (let pos = 0; pos < 25; pos++) {
    if (pos === 12) {
      casas.push({
        posicao: 12,
        item_id: null,
        texto: 'Natal em Família (Livre)',
        livre: true,
      });
    } else {
      const item = escolhidos[cursor++];
      casas.push({
        posicao: pos,
        item_id: item && item.id > 0 ? item.id : null,
        texto: item ? item.texto : `Situação ${pos + 1}`,
        livre: false,
      });
    }
  }
  return casas;
}

async function garantirItensPadrao(ano: number): Promise<void> {
  const countRes = await query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM party_bingo_items WHERE ano = $1`,
    [ano],
  );
  if ((countRes.rows[0]?.total ?? 0) > 0) return;

  await transaction(async (q) => {
    // Lock por ano: quem chega junto espera e ja encontra os itens criados
    await q(`SELECT pg_advisory_xact_lock(4101, $1::int)`, [ano]);
    const check = await q<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM party_bingo_items WHERE ano = $1`,
      [ano],
    );
    if ((check.rows[0]?.total ?? 0) > 0) return;

    await q(
      `INSERT INTO party_bingo_items (ano, texto, ativo)
       SELECT $1::int, t.texto, true
         FROM unnest($2::text[]) WITH ORDINALITY AS t(texto, ord)
        ORDER BY t.ord`,
      [ano, ITENS_PADRAO_BINGO],
    );
  });
}

export async function carregarBingo(me: SessionUser): Promise<BingoData> {
  const ano = edicaoAtual();
  await garantirItensPadrao(ano);

  const itensRes = await query<BingoItemRow>(
    `SELECT id, texto, ativo
       FROM party_bingo_items
      WHERE ano = $1
      ORDER BY id ASC`,
    [ano],
  );
  const itens = itensRes.rows;
  const itensAtivos = itens.filter((i) => i.ativo);

  // Garante a cartela 5x5 da pessoa logada
  let cardRes = await query<{ id: number; casas: BingoCasa[] }>(
    `SELECT id, casas FROM party_bingo_cards WHERE ano = $1 AND user_id = $2`,
    [ano, me.id],
  );

  if (!cardRes.rows[0]) {
    const novasCasas = montarCasasSorteadas(itensAtivos);
    await query(
      `WITH nova AS (
         INSERT INTO party_bingo_cards (ano, user_id, casas)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (ano, user_id) DO NOTHING
         RETURNING id
       )
       INSERT INTO party_bingo_marks (ano, card_id, user_id, posicao)
       SELECT $1::int, id, $2::int, 12 FROM nova
       ON CONFLICT (card_id, posicao) DO NOTHING`,
      [ano, me.id, JSON.stringify(novasCasas)],
    );
    cardRes = await query<{ id: number; casas: BingoCasa[] }>(
      `SELECT id, casas FROM party_bingo_cards WHERE ano = $1 AND user_id = $2`,
      [ano, me.id],
    );
  }

  const card = cardRes.rows[0];
  const marksRes = await query<{ posicao: number }>(
    `SELECT posicao FROM party_bingo_marks WHERE ano = $1 AND card_id = $2 ORDER BY posicao ASC`,
    [ano, card.id],
  );
  // O centro livre e gravado na criacao da cartela; so repara se faltar na lista lida
  if (!marksRes.rows.some((r) => r.posicao === 12)) {
    await query(
      `INSERT INTO party_bingo_marks (ano, card_id, user_id, posicao)
       VALUES ($1, $2, $3, 12)
       ON CONFLICT (card_id, posicao) DO NOTHING`,
      [ano, card.id, me.id],
    );
  }
  const marcadasSet = new Set<number>([12, ...marksRes.rows.map((r) => r.posicao)]);
  const marcadas = Array.from(marcadasSet).sort((a, b) => a - b);
  const padroes_completos = detectarPadroesCompletos(marcadasSet);

  const claimsRes = await query<{
    id: number;
    user_id: number;
    user_name: string;
    avatar_url: string | null;
    padrao: string;
    posicoes: number[];
    casas: BingoCasa[];
    status: 'pendente' | 'confirmado' | 'rejeitado';
    confirmed_by_name: string | null;
    created_at: string;
  }>(
    `SELECT c.id,
            c.user_id,
            u.name AS user_name,
            u.avatar_url,
            c.padrao,
            c.posicoes,
            card.casas,
            c.status,
            adm.name AS confirmed_by_name,
            c.created_at::text AS created_at
       FROM party_bingo_claims c
       JOIN family_users u ON u.id = c.user_id
       JOIN party_bingo_cards card ON card.id = c.card_id AND card.ano = c.ano
       LEFT JOIN family_users adm ON adm.id = c.confirmed_by
      WHERE c.ano = $1
        AND NOT EXISTS (
          SELECT 1 FROM user_blocks b
           WHERE (b.blocker_id = $2 AND b.blocked_id = c.user_id)
              OR (b.blocker_id = c.user_id AND b.blocked_id = $2)
        )
      ORDER BY
        CASE WHEN c.status = 'confirmado' THEN 0 WHEN c.status = 'pendente' THEN 1 ELSE 2 END,
        c.created_at DESC`,
    [ano, me.id],
  );

  const claims: BingoClaimItem[] = claimsRes.rows.map((row) => {
    const posArr = Array.isArray(row.posicoes) ? row.posicoes.map(Number) : [];
    const casasArr = Array.isArray(row.casas) ? row.casas : [];
    const frases = posArr.map((p) => {
      const found = casasArr.find((cs) => Number(cs.posicao) === p);
      return found ? found.texto : `Casa ${p + 1}`;
    });
    return {
      id: row.id,
      user_id: row.user_id,
      user_name: row.user_name,
      avatar_url: row.avatar_url,
      padrao: row.padrao,
      posicoes: posArr,
      frases,
      status: row.status,
      confirmed_by_name: row.confirmed_by_name,
      created_at: row.created_at,
    };
  });

  const ja_gritou = claims.some(
    (c) => c.user_id === me.id && (c.status === 'pendente' || c.status === 'confirmado'),
  );

  const partRes = await query<BingoParticipanteProgresso>(
    `SELECT c.user_id,
            u.name,
            u.avatar_url,
            COUNT(DISTINCT m.posicao)::int AS marcadas,
            EXISTS (
              SELECT 1 FROM party_bingo_claims cl
               WHERE cl.ano = c.ano
                 AND cl.card_id = c.id
                 AND cl.status IN ('pendente', 'confirmado')
            ) AS tem_bingo
       FROM party_bingo_cards c
       JOIN family_users u ON u.id = c.user_id
       LEFT JOIN party_bingo_marks m ON m.card_id = c.id AND m.ano = c.ano
      WHERE c.ano = $1
        AND NOT EXISTS (
          SELECT 1 FROM user_blocks b
           WHERE (b.blocker_id = $2 AND b.blocked_id = c.user_id)
              OR (b.blocker_id = c.user_id AND b.blocked_id = $2)
        )
      GROUP BY c.id, c.user_id, u.name, u.avatar_url
      ORDER BY tem_bingo DESC, marcadas DESC, u.name ASC`,
    [ano, me.id],
  );

  return {
    ano,
    cartela: {
      id: card.id,
      casas: Array.isArray(card.casas) ? card.casas : [],
      marcadas,
      padroes_completos,
      ja_gritou,
    },
    claims,
    participantes: partRes.rows,
    itens,
  };
}
