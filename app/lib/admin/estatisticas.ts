import { query } from '@/app/lib/db';
import { edicaoAtual, hojeSP } from '@/app/lib/edicao';
import type { Estatisticas } from './painel-tipos';
import { num, somarDias } from './formato';
import { numerosVaquinha } from './numeros';

async function tabelaExiste(nome: string): Promise<boolean> {
  const { rows } = await query<{ existe: boolean }>(
    `SELECT to_regclass($1) IS NOT NULL AS existe`,
    [`public.${nome}`],
  );
  return rows[0]?.existe === true;
}

type Contagem = { status: string; respostas: number; adultos: number; criancas: number };

export async function carregarEstatisticas(): Promise<Estatisticas> {
  const ano = edicaoAtual();
  const hoje = hojeSP();
  const inicio = somarDias(hoje, -29);
  const semana = somarDias(hoje, -6);
  const contagemAtiva = await tabelaExiste('family_daily_visits');

  const acessosSql = contagemAtiva
    ? query<{ dia: string; pessoas: number }>(
      `WITH dias AS (
         SELECT generate_series($1::date, $2::date, INTERVAL '1 day')::date AS dia
       )
       SELECT d.dia::text AS dia, COUNT(v.user_id)::int AS pessoas
         FROM dias d
         LEFT JOIN family_daily_visits v ON v.dia = d.dia
        GROUP BY d.dia
        ORDER BY d.dia`,
      [inicio, hoje],
    )
    : Promise.resolve({ rows: [] as { dia: string; pessoas: number }[] });

  const ativosSql = contagemAtiva
    ? query<{ n: number }>(
      `SELECT COUNT(DISTINCT user_id)::int AS n
         FROM family_daily_visits
        WHERE dia >= $1::date AND dia <= $2::date`,
      [semana, hoje],
    )
    : Promise.resolve({ rows: [{ n: 0 }] });

  const nuncaSql = contagemAtiva
    ? query<{ id: number; nome: string }>(
      `SELECT u.id, u.name AS nome
         FROM family_users u
        WHERE NOT EXISTS (SELECT 1 FROM family_daily_visits v WHERE v.user_id = u.id)
        ORDER BY u.name, u.id`,
    )
    : Promise.resolve({ rows: [] as { id: number; nome: string }[] });

  const [acessos, ativos, nunca, presenca, vaquinha, atividade, ranking] = await Promise.all([
    acessosSql,
    ativosSql,
    nuncaSql,
    query<Contagem>(
      `SELECT a.status,
              COUNT(*)::int AS respostas,
              COALESCE(SUM(COALESCE(a.adultos, CASE WHEN a.status = 'no' THEN 0 ELSE 1 END)), 0)::int AS adultos,
              COALESCE(SUM(COALESCE(a.criancas, 0)), 0)::int AS criancas
         FROM family_attendance a
        WHERE a.status IN ('yes', 'maybe', 'no')
          AND (a.ano IS NULL OR a.ano = $1)
        GROUP BY a.status`,
      [ano],
    ),
    numerosVaquinha(ano),
    query<{ dia: string; posts: number; fotos: number }>(
      `WITH dias AS (
         SELECT generate_series($1::date, $2::date, INTERVAL '1 day')::date AS dia
       ),
       posts AS (
         SELECT (created_at::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
                COUNT(*)::int AS n
           FROM family_posts
          WHERE ano = $3 AND created_at IS NOT NULL
          GROUP BY 1
       ),
       fotos AS (
         SELECT (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
                COUNT(*)::int AS n
           FROM album_photos
          WHERE ano = $3
          GROUP BY 1
       )
       SELECT d.dia::text AS dia,
              COALESCE(p.n, 0)::int AS posts,
              COALESCE(f.n, 0)::int AS fotos
         FROM dias d
         LEFT JOIN posts p ON p.dia = d.dia
         LEFT JOIN fotos f ON f.dia = d.dia
        ORDER BY d.dia`,
      [inicio, hoje, ano],
    ),
    query<{ id: number; nome: string; posts: number; fotos: number; comentarios: number; curtidas: number }>(
      `WITH posts AS (
         SELECT user_id, COUNT(*)::int AS n FROM family_posts WHERE ano = $1 GROUP BY user_id
       ),
       fotos AS (
         SELECT user_id, COUNT(*)::int AS n FROM album_photos WHERE ano = $1 GROUP BY user_id
       ),
       comentarios AS (
         SELECT c.user_id, COUNT(*)::int AS n
           FROM family_post_comments c
           JOIN family_posts p ON p.id = c.post_id
          WHERE p.ano = $1
          GROUP BY c.user_id
       ),
       curtidas AS (
         SELECT user_id, COUNT(*)::int AS n FROM (
           SELECT r.user_id
             FROM family_post_reactions r
             JOIN family_posts p ON p.id = r.post_id
            WHERE p.ano = $1
           UNION ALL
           SELECT user_id FROM album_photo_likes WHERE ano = $1
         ) c
         GROUP BY user_id
       )
       SELECT u.id, u.name AS nome,
              COALESCE(posts.n, 0)::int AS posts,
              COALESCE(fotos.n, 0)::int AS fotos,
              COALESCE(comentarios.n, 0)::int AS comentarios,
              COALESCE(curtidas.n, 0)::int AS curtidas
         FROM family_users u
         LEFT JOIN posts ON posts.user_id = u.id
         LEFT JOIN fotos ON fotos.user_id = u.id
         LEFT JOIN comentarios ON comentarios.user_id = u.id
         LEFT JOIN curtidas ON curtidas.user_id = u.id
        WHERE COALESCE(posts.n, 0) + COALESCE(fotos.n, 0) + COALESCE(comentarios.n, 0) + COALESCE(curtidas.n, 0) > 0
        ORDER BY (COALESCE(posts.n, 0) + COALESCE(fotos.n, 0) + COALESCE(comentarios.n, 0) + COALESCE(curtidas.n, 0)) DESC,
                 u.name, u.id
        LIMIT 10`,
      [ano],
    ),
  ]);

  const porStatus = new Map(presenca.rows.map((r) => [r.status, r]));
  const bloco = (status: string) => porStatus.get(status) ?? { status, respostas: 0, adultos: 0, criancas: 0 };
  const vou = bloco('yes');

  return {
    contagem_ativa: contagemAtiva,
    acessos: acessos.rows.map((r) => ({ dia: String(r.dia).slice(0, 10), pessoas: num(r.pessoas) })),
    ativos_semana: num(ativos.rows[0]?.n),
    nunca_entraram: nunca.rows.map((r) => ({ id: num(r.id), nome: r.nome })),
    presenca: {
      vou: num(vou.respostas),
      talvez: num(bloco('maybe').respostas),
      nao: num(bloco('no').respostas),
      adultos: num(vou.adultos),
      criancas: num(vou.criancas),
      pessoas: num(vou.adultos) + num(vou.criancas),
    },
    vaquinha: {
      arrecadado_centavos: vaquinha.arrecadado_centavos,
      meta_centavos: vaquinha.meta_centavos,
      pagaram: vaquinha.pagaram,
      participantes: vaquinha.participantes,
    },
    atividade: atividade.rows.map((r) => ({
      dia: String(r.dia).slice(0, 10),
      posts: num(r.posts),
      fotos: num(r.fotos),
    })),
    ranking: ranking.rows.map((r) => {
      const posts = num(r.posts);
      const fotos = num(r.fotos);
      const comentarios = num(r.comentarios);
      const curtidas = num(r.curtidas);
      return {
        id: num(r.id),
        nome: r.nome,
        posts,
        fotos,
        comentarios,
        curtidas,
        pontos: posts + fotos + comentarios + curtidas,
      };
    }),
  };
}
