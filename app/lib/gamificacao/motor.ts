import 'server-only';
import { recuperarInterrompidas } from '@/app/api/karaoke/prova/_dados';
import { parsePostImages } from '@/app/api/posts/_utils';
import { query, transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { enviarPush } from '@/app/lib/push';
import {
  avaliarConquistasAlcancadas,
  IDS_CONQUISTAS_IRREVOGAVEIS,
  MAPA_CONQUISTAS,
  metricasVazias,
  pontosDaConquista,
  type DefinicaoConquista,
  type MetricasUsuario,
} from './catalogo';
import {
  horarioPermitidoPushSP,
  planejarMissaoSurpresa,
  relogioSP,
} from './missoes';
import {
  aplicarTetosFatos,
  calcularLancamentosKaraoke,
  comentarioValidoParaPontos,
  configPadrao,
  contarLetrasUteis,
  curtoDataSP,
  diaSPDeISO,
  inicioEdicaoISO,
  postValidoParaPontos,
  type FatoBruto,
  type FatoKaraoke,
  type LancamentoGerado,
} from './regras';
import type { ConfigGamificacao } from './tipos';

const LOCK_RECALCULAR = 20261224;
const LOCK_CRON_GAMI = 20261225;
const RECALCULO_FRESCO_MS = 60_000;
export const CONTA_REVISAO_LOJAS = 'Revisão das Lojas';

const ultimoRecalculoMemoria = new Map<number, number>();
const recalculosEmAndamento = new Set<number>();

const TABELAS_CONHECIDAS = [
  'gami_config',
  'gami_lancamentos',
  'gami_conquistas',
  'gami_ajustes',
  'gami_missoes',
  'gami_missoes_respostas',
  'family_users',
  'family_daily_visits',
  'participants',
  'family_posts',
  'family_post_comments',
  'family_post_reactions',
  'family_polls',
  'family_poll_votes',
  'family_attendance',
  'family_notifications',
  'payments',
  'secret_santa_draws',
  'secret_santa_config',
  'secret_santa_hints',
  'secret_santa_history',
  'wish_list',
  'advent_responses',
  'advent_votes',
  'advent_opens',
  'ceia_dishes',
  'ceia_votos',
  'playlist_tracks',
  'family_recipes',
  'family_stories',
  'time_capsules',
  'family_tree_people',
  'family_tree_links',
  'family_memorials',
  'family_tributes',
  'family_memorial_candles',
  'album_photos',
  'album_tags',
  'album_photo_likes',
  'party_challenges',
  'party_photo_entries',
  'party_photo_votes',
  'party_quiz_questions',
  'party_quiz_state',
  'party_quiz_answers',
  'party_bingo_cards',
  'party_bingo_marks',
  'party_bingo_claims',
  'party_live_polls',
  'party_live_poll_votes',
  'party_teams',
  'party_team_members',
  'party_mimica',
  'party_bebe',
  'party_bebe_votos',
  'party_roleta',
  'karaoke_fila',
  'karaoke_notas',
  'karaoke_batalhas',
  'karaoke_catalogo',
  'karaoke_prova',
  'karaoke_prova_tentativas',
  'user_blocks',
] as const;

export interface EsquemaBanco {
  colunas: Map<string, Set<string>>;
  semFuso: Map<string, Set<string>>;
}

export async function inspecionarEsquema(q: typeof query = query): Promise<EsquemaBanco> {
  const { rows } = await q<{ tabela: string; colunas: string[]; sem_fuso: string[] | null }>(
    `SELECT t.nome AS tabela,
            ARRAY_AGG(a.attname::text) AS colunas,
            ARRAY_AGG(a.attname::text) FILTER (WHERE a.atttypid = 'timestamp'::regtype) AS sem_fuso
       FROM unnest($1::text[]) t(nome)
       JOIN pg_attribute a ON a.attrelid = to_regclass('public.' || t.nome)
        AND a.attnum > 0 AND NOT a.attisdropped
      GROUP BY t.nome`,
    [TABELAS_CONHECIDAS],
  );
  return {
    colunas: new Map(rows.map((r) => [r.tabela, new Set(r.colunas)])),
    semFuso: new Map(rows.map((r) => [r.tabela, new Set(r.sem_fuso ?? [])])),
  };
}

export function tem(e: EsquemaBanco, tabela: string, ...cols: string[]): boolean {
  const set = e.colunas.get(tabela);
  if (!set) return false;
  return cols.every((c) => set.has(c));
}

function tsSQL(e: EsquemaBanco, tabela: string, alias: string, col: string): string {
  const expr = `${alias}.${col}`;
  return e.semFuso.get(tabela)?.has(col) ? `(${expr} AT TIME ZONE 'UTC')` : expr;
}

function anoSQL(e: EsquemaBanco, tabela: string, alias: string, colTs = 'created_at'): string {
  if (tem(e, tabela, 'ano')) return `${alias}.ano`;
  const ts = tsSQL(e, tabela, alias, colTs);
  return `EXTRACT(YEAR FROM (${ts} AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '2 months')::int`;
}

function paraISO(valor: Date | string | null | undefined): string | null {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function resumir(texto: string | null | undefined, max = 48): string {
  const s = (texto ?? '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max - 3)}...` : s;
}

function maiorSequenciaDias(diasOrdenados: readonly string[]): number {
  if (diasOrdenados.length === 0) return 0;
  const unicos = [...new Set(diasOrdenados)].sort();
  let maior = 1;
  let atual = 1;
  for (let i = 1; i < unicos.length; i++) {
    const ant = Date.parse(`${unicos[i - 1]}T12:00:00Z`);
    const cur = Date.parse(`${unicos[i]}T12:00:00Z`);
    const diffDias = Math.round((cur - ant) / 86_400_000);
    if (diffDias === 1) {
      atual++;
      if (atual > maior) maior = atual;
    } else {
      atual = 1;
    }
  }
  return maior;
}

function vencedorBatalhaLinhas(a: unknown, b: unknown): 1 | 2 | null {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) return null;
  let p1 = 0;
  let p2 = 0;
  for (let i = 0; i < a.length; i++) {
    const n1 = Number(a[i]);
    const n2 = Number(b[i]);
    if (!Number.isFinite(n1) || !Number.isFinite(n2)) return null;
    const r1 = Math.round(n1 * 1000) / 1000;
    const r2 = Math.round(n2 * 1000) / 1000;
    if (r1 > r2) p1++;
    else if (r2 > r1) p2++;
  }
  if (p1 === p2) return null;
  return p1 > p2 ? 1 : 2;
}

export async function buscarIdsExcluidosPadrao(
  q: typeof query = query,
  e?: EsquemaBanco,
): Promise<number[]> {
  const esquema = e ?? await inspecionarEsquema(q);
  if (!tem(esquema, 'family_users', 'id', 'name')) return [];
  const { rows } = await q<{ id: number }>(
    `SELECT id FROM family_users WHERE name = $1 ORDER BY id`,
    [CONTA_REVISAO_LOJAS],
  );
  return rows.map((r) => Number(r.id)).filter((id) => Number.isInteger(id) && id > 0);
}

export interface ConfigInterna extends ConfigGamificacao {
  excluidos: number[];
  recalculado_em: string | null;
}

export async function lerConfigInterna(
  ano = edicaoAtual(),
  q: typeof query = query,
  esquemaExistente?: EsquemaBanco,
): Promise<ConfigInterna> {
  const e = esquemaExistente ?? await inspecionarEsquema(q);
  const excluidosPadrao = await buscarIdsExcluidosPadrao(q, e);
  const padrao = configPadrao(ano, excluidosPadrao);

  if (!tem(e, 'gami_config', 'ano', 'encerra_em', 'ranking_oculto_em', 'revelado_em', 'missoes_surpresa')) {
    const mem = ultimoRecalculoMemoria.get(ano);
    return {
      ...padrao,
      excluidos: padrao.excluidos ?? excluidosPadrao,
      recalculado_em: mem ? new Date(mem).toISOString() : null,
    };
  }

  const colRecalc = tem(e, 'gami_config', 'recalculado_em') ? 'recalculado_em' : 'NULL::timestamptz AS recalculado_em';
  const colExcl = tem(e, 'gami_config', 'excluidos') ? 'excluidos' : 'NULL::int[] AS excluidos';
  const { rows } = await q<{
    ano: number;
    encerra_em: Date | string;
    ranking_oculto_em: Date | string;
    revelado_em: Date | string | null;
    missoes_surpresa: boolean;
    excluidos: number[] | null;
    recalculado_em: Date | string | null;
  }>(
    `SELECT ano, encerra_em, ranking_oculto_em, revelado_em, missoes_surpresa, ${colExcl}, ${colRecalc}
       FROM gami_config WHERE ano = $1`,
    [ano],
  );
  const r = rows[0];
  if (!r) {
    const mem = ultimoRecalculoMemoria.get(ano);
    return {
      ...padrao,
      excluidos: padrao.excluidos ?? excluidosPadrao,
      recalculado_em: mem ? new Date(mem).toISOString() : null,
    };
  }

  const excluidosSalvos = Array.isArray(r.excluidos)
    ? [...new Set(r.excluidos.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
    : excluidosPadrao;

  return {
    ano: Number(r.ano),
    encerra_em: paraISO(r.encerra_em) ?? padrao.encerra_em,
    ranking_oculto_em: paraISO(r.ranking_oculto_em) ?? padrao.ranking_oculto_em,
    revelado_em: paraISO(r.revelado_em),
    missoes_surpresa: Boolean(r.missoes_surpresa),
    excluidos: excluidosSalvos,
    recalculado_em: paraISO(r.recalculado_em) ?? (
      ultimoRecalculoMemoria.has(ano) ? new Date(ultimoRecalculoMemoria.get(ano)!).toISOString() : null
    ),
  };
}

export async function lerConfig(ano = edicaoAtual(), q: typeof query = query): Promise<ConfigGamificacao> {
  const c = await lerConfigInterna(ano, q);
  return {
    ano: c.ano,
    encerra_em: c.encerra_em,
    ranking_oculto_em: c.ranking_oculto_em,
    revelado_em: c.revelado_em,
    missoes_surpresa: c.missoes_surpresa,
    excluidos: c.excluidos,
  };
}

export async function carregarAnuladosEdicao(
  q: typeof query,
  e: EsquemaBanco,
  ano: number,
): Promise<{
  anulados: Map<number, Set<string>>;
  ajustesRows: {
    id: string | number;
    user_id: number;
    pontos: number;
    motivo: string;
    anula_ref: string | null;
    created_at: Date | string;
  }[];
}> {
  const anulados = new Map<number, Set<string>>();
  let ajustesRows: {
    id: string | number;
    user_id: number;
    pontos: number;
    motivo: string;
    anula_ref: string | null;
    created_at: Date | string;
  }[] = [];

  if (tem(e, 'gami_ajustes', 'id', 'ano', 'user_id', 'pontos', 'motivo', 'anula_ref', 'created_at')) {
    const resAj = await q<typeof ajustesRows[number]>(
      `SELECT id, user_id, pontos, motivo, anula_ref, created_at
         FROM gami_ajustes WHERE ano = $1 ORDER BY id`,
      [ano],
    );
    ajustesRows = resAj.rows;
    for (const aj of ajustesRows) {
      if (aj.anula_ref) {
        const uid = Number(aj.user_id);
        const s = anulados.get(uid) ?? new Set<string>();
        s.add(aj.anula_ref.trim());
        anulados.set(uid, s);
      }
    }
  }

  return { anulados, ajustesRows };
}

export interface ColetaEdicao {
  usuarios: { id: number; name: string; avatar_url: string | null }[];
  fatos: FatoBruto[];
  karaoke: FatoKaraoke[];
  lancamentosFatos: LancamentoGerado[];
  lancamentosKaraoke: LancamentoGerado[];
  metricasPorUser: Map<number, MetricasUsuario>;
}

/**
 * Coleta métricas e fatos brutos em paralelo usando o pool (somente leitura),
 * respeitando inicio_em .. encerra_em, validade de conteúdo e tetos diários/edição.
 */
export async function coletarDadosEdicao(
  q: typeof query,
  e: EsquemaBanco,
  ano: number,
  encerraIso: string,
  anuladosExistentes?: ReadonlyMap<number, ReadonlySet<string>>,
): Promise<ColetaEdicao> {
  const inicioIso = inicioEdicaoISO(ano);
  const inicioMs = Date.parse(inicioIso);
  const encerraMs = Date.parse(encerraIso);

  if (!tem(e, 'family_users', 'id', 'name')) {
    return {
      usuarios: [],
      fatos: [],
      karaoke: [],
      lancamentosFatos: [],
      lancamentosKaraoke: [],
      metricasPorUser: new Map(),
    };
  }

  const colAvatar = tem(e, 'family_users', 'avatar_url') ? 'avatar_url' : 'NULL::text AS avatar_url';
  const [usuariosRes, anuladosRes] = await Promise.all([
    q<{ id: number; name: string; avatar_url: string | null }>(
      `SELECT id, name, ${colAvatar} FROM family_users ORDER BY id`,
    ),
    anuladosExistentes
      ? Promise.resolve({ anulados: anuladosExistentes })
      : carregarAnuladosEdicao(q, e, ano),
  ]);

  const usuarios = usuariosRes.rows;
  const anulados = anuladosRes.anulados;
  const idsValidos = new Set(usuarios.map((u) => Number(u.id)));
  const metricasPorUser = new Map<number, MetricasUsuario>();
  for (const u of usuarios) {
    const m = metricasVazias();
    m.perfis_familia = usuarios.length;
    metricasPorUser.set(Number(u.id), m);
  }
  const metricaDe = (uid: number): MetricasUsuario | null => metricasPorUser.get(uid) ?? null;

  const edicoesPorUser = new Map<number, Set<number>>();
  const vaquinhaEdicoesPorUser = new Map<number, Set<number>>();
  const marcarEdicao = (uid: number, ed: number) => {
    if (!idsValidos.has(uid) || !Number.isInteger(ed) || ed < 2020 || ed > ano) return;
    const s = edicoesPorUser.get(uid) ?? new Set<number>();
    s.add(ed);
    edicoesPorUser.set(uid, s);
  };

  const fatos: FatoBruto[] = [];
  const karaoke: FatoKaraoke[] = [];

  const dentroDaJanela = (iso: string | null): iso is string => {
    if (!iso) return false;
    const ms = Date.parse(iso);
    return Number.isFinite(ms) && ms >= inicioMs && ms <= encerraMs;
  };

  // Metadados dos fatos de volume para alimentar as conquistas apenas com o que sobreviver a aplicarTetosFatos.
  const metaPostPorRef = new Map<string, {
    uid: number;
    temFoto: boolean;
    postLongo: boolean;
    madrugada: boolean;
    cedo: boolean;
  }>();
  const postsValidosEdicao = new Set<number>();
  const metaComentarioPorRef = new Map<string, {
    uid: number;
    dono: number;
    madrugada: boolean;
  }>();
  const metaReacaoPorRef = new Map<string, {
    uid: number;
    dono: number;
    postId: number;
  }>();
  const metaCapsulaPorRef = new Map<string, {
    uid: number;
    destinatario: number | null;
  }>();
  const metaMissaoPorRef = new Map<string, {
    uid: number;
    rapida15min: boolean;
  }>();

  const reacoesBrutas: {
    id: number;
    post_id: number;
    user_id: number;
    post_owner: number;
    post_ano: number;
    ocorreu: Date | string;
  }[] = [];

  await Promise.all([
    // 1) Visitas diárias
    (async () => {
      if (!tem(e, 'family_daily_visits', 'user_id', 'dia', 'primeira')) return;
      const diaInicio = `${ano}-11-01`;
      const diaFim = diaSPDeISO(encerraIso);
      const { rows } = await q<{ user_id: number; dia: string; primeira: Date | string }>(
        `SELECT user_id, dia::text AS dia, ${tsSQL(e, 'family_daily_visits', 'v', 'primeira')} AS primeira
           FROM family_daily_visits v
          WHERE v.dia >= $1::date AND v.dia <= $2::date
          ORDER BY v.dia, v.user_id`,
        [diaInicio, diaFim],
      );
      const diasPorUser = new Map<number, string[]>();
      for (const r of rows) {
        const uid = Number(r.user_id);
        const m = metricaDe(uid);
        if (!m) continue;
        let iso = paraISO(r.primeira) ?? `${r.dia}T12:00:00-03:00`;
        if (Date.parse(iso) < inicioMs) iso = `${r.dia}T00:01:00-03:00`;
        if (Date.parse(iso) > encerraMs) continue;
        marcarEdicao(uid, ano);
        const lista = diasPorUser.get(uid) ?? [];
        lista.push(r.dia);
        diasPorUser.set(uid, lista);

        if (r.dia.startsWith(`${ano}-12-`)) m.visitas_dezembro++;
        if (r.dia === `${ano}-12-24`) m.abriu_vespera = true;
        const spHora = relogioSP(new Date(iso)).hora;
        if (spHora >= 5 && spHora < 7) m.abriu_cedo = true;

        const ddmm = `${r.dia.slice(8, 10)}/${r.dia.slice(5, 7)}`;
        fatos.push({
          user_id: uid,
          origem: 'uso',
          regra: 'visita',
          ref: `visita:${r.dia}`,
          pontos: 5,
          descricao: `Abriu o app (${ddmm})`,
          ocorreu_em: iso,
        });
      }
      for (const [uid, dias] of diasPorUser) {
        const m = metricaDe(uid);
        if (!m) continue;
        const unicos = new Set(dias);
        m.visitas_dias = unicos.size;
        m.visitas_seguidas = maiorSequenciaDias([...unicos]);
      }
    })(),

    // 2) Publicações no mural (somente válidas contam para pontos e conquistas)
    (async () => {
      if (!tem(e, 'family_posts', 'id', 'user_id', 'content', 'created_at')) return;
      const colImg = tem(e, 'family_posts', 'image_url') ? 'p.image_url' : 'NULL::text AS image_url';
      const colImgs = tem(e, 'family_posts', 'image_urls') ? 'p.image_urls' : 'NULL::text AS image_urls';
      const { rows } = await q<{
        id: number;
        user_id: number;
        ano: number;
        content: string;
        image_url: string | null;
        image_urls: string | null;
        ocorreu: Date | string;
      }>(
        `SELECT p.id, p.user_id, ${anoSQL(e, 'family_posts', 'p')} AS ano, p.content, ${colImg}, ${colImgs},
                ${tsSQL(e, 'family_posts', 'p', 'created_at')} AS ocorreu
           FROM family_posts p
          WHERE p.created_at IS NOT NULL
          ORDER BY p.id`,
      );
      for (const p of rows) {
        const uid = Number(p.user_id);
        const imgs = parsePostImages(p.image_urls, p.image_url);
        const valido = postValidoParaPontos(p.content, imgs.length > 0);
        if (!valido) continue;

        marcarEdicao(uid, Number(p.ano));
        if (Number(p.ano) !== ano) continue;
        const iso = paraISO(p.ocorreu);
        if (!dentroDaJanela(iso) || !metricaDe(uid)) continue;

        const postId = Number(p.id);
        postsValidosEdicao.add(postId);
        const ref = `post:${postId}`;
        const hora = relogioSP(new Date(iso)).hora;

        metaPostPorRef.set(`${uid}|${ref}`, {
          uid,
          temFoto: imgs.length > 0,
          postLongo: contarLetrasUteis(p.content) > 400,
          madrugada: hora >= 0 && hora < 5,
          cedo: hora >= 5 && hora < 7,
        });

        fatos.push({
          user_id: uid,
          origem: 'uso',
          regra: 'post',
          ref,
          pontos: 5,
          descricao: `Publicação no mural (${curtoDataSP(iso)})`,
          ocorreu_em: iso,
        });
      }
    })(),

    // 3) Álbum de fotos, marcações e curtidas (com filtro created_at <= encerra_em)
    (async () => {
      if (tem(e, 'album_photos', 'id', 'ano', 'user_id', 'created_at')) {
        const { rows } = await q<{ id: number; user_id: number; ocorreu: Date | string }>(
          `SELECT a.id, a.user_id, ${tsSQL(e, 'album_photos', 'a', 'created_at')} AS ocorreu
             FROM album_photos a
            WHERE a.ano = $1
              AND ${tsSQL(e, 'album_photos', 'a', 'created_at')} <= $2::timestamptz
            ORDER BY a.id`,
          [ano, encerraIso],
        );
        for (const f of rows) {
          const uid = Number(f.user_id);
          const iso = paraISO(f.ocorreu);
          if (!dentroDaJanela(iso) || !metricaDe(uid)) continue;
          marcarEdicao(uid, ano);
          fatos.push({
            user_id: uid,
            origem: 'uso',
            regra: 'foto_album',
            ref: `album:${f.id}`,
            pontos: 3,
            descricao: `Foto no álbum da família (${curtoDataSP(iso)})`,
            ocorreu_em: iso,
          });
        }
      }

      if (tem(e, 'album_tags', 'ano', 'user_id')) {
        if (tem(e, 'album_tags', 'created_at')) {
          const colChave = tem(e, 'album_tags', 'photo_key', 'person_source', 'person_id')
            ? `COUNT(DISTINCT (t.photo_key || '|' || t.person_source || ':' || t.person_id))::int`
            : `COUNT(*)::int`;
          const { rows } = await q<{ user_id: number; total: number }>(
            `SELECT t.user_id, ${colChave} AS total
               FROM album_tags t
              WHERE t.ano = $1
                AND ${tsSQL(e, 'album_tags', 't', 'created_at')} >= $2::timestamptz
                AND ${tsSQL(e, 'album_tags', 't', 'created_at')} <= $3::timestamptz
              GROUP BY t.user_id`,
            [ano, inicioIso, encerraIso],
          );
          for (const r of rows) {
            const m = metricaDe(Number(r.user_id));
            if (m) m.marcacoes_album = Number(r.total);
          }
        } else if (tem(e, 'album_tags', 'photo_key') && tem(e, 'album_photos', 'id', 'ano', 'created_at')) {
          const { rows } = await q<{ user_id: number; total: number }>(
            `SELECT t.user_id, COUNT(*)::int AS total
               FROM album_tags t
              WHERE t.ano = $1
                AND (
                  EXISTS (
                    SELECT 1 FROM album_photos a
                     WHERE a.ano = $1
                       AND t.photo_key LIKE ('album-' || a.id || '-%')
                       AND ${tsSQL(e, 'album_photos', 'a', 'created_at')} <= $2::timestamptz
                  )
                  OR ${
                    tem(e, 'family_posts', 'id', 'created_at')
                      ? `EXISTS (
                          SELECT 1 FROM family_posts p
                           WHERE t.photo_key LIKE ('post-' || p.id || '-%')
                             AND ${tsSQL(e, 'family_posts', 'p', 'created_at')} <= $2::timestamptz
                        )`
                      : 'false'
                  }
                )
              GROUP BY t.user_id`,
            [ano, encerraIso],
          );
          for (const r of rows) {
            const m = metricaDe(Number(r.user_id));
            if (m) m.marcacoes_album = Number(r.total);
          }
        }
      }

      if (tem(e, 'album_photo_likes', 'ano', 'user_id', 'photo_id')) {
        if (tem(e, 'album_photo_likes', 'created_at')) {
          const { rows } = await q<{ user_id: number; total: number }>(
            `SELECT l.user_id, COUNT(DISTINCT l.photo_id)::int AS total
               FROM album_photo_likes l
              WHERE l.ano = $1
                AND ${tsSQL(e, 'album_photo_likes', 'l', 'created_at')} >= $2::timestamptz
                AND ${tsSQL(e, 'album_photo_likes', 'l', 'created_at')} <= $3::timestamptz
              GROUP BY l.user_id`,
            [ano, inicioIso, encerraIso],
          );
          for (const r of rows) {
            const m = metricaDe(Number(r.user_id));
            if (m) m.curtidas_album_dadas = Number(r.total);
          }
        } else if (tem(e, 'album_photos', 'id', 'ano', 'created_at')) {
          const { rows } = await q<{ user_id: number; total: number }>(
            `SELECT l.user_id, COUNT(DISTINCT l.photo_id)::int AS total
               FROM album_photo_likes l
               JOIN album_photos a ON a.id = l.photo_id
              WHERE l.ano = $1
                AND ${tsSQL(e, 'album_photos', 'a', 'created_at')} >= $2::timestamptz
                AND ${tsSQL(e, 'album_photos', 'a', 'created_at')} <= $3::timestamptz
              GROUP BY l.user_id`,
            [ano, inicioIso, encerraIso],
          );
          for (const r of rows) {
            const m = metricaDe(Number(r.user_id));
            if (m) m.curtidas_album_dadas = Number(r.total);
          }
        }
      }
    })(),

    // 4) Comentários no mural (somente válidos com 3+ letras contam)
    (async () => {
      if (!tem(e, 'family_post_comments', 'id', 'post_id', 'user_id', 'content', 'created_at')
          || !tem(e, 'family_posts', 'id', 'user_id')) {
        return;
      }
      const { rows } = await q<{
        id: number;
        user_id: number;
        post_owner: number;
        ano: number;
        content: string;
        ocorreu: Date | string;
      }>(
        `SELECT c.id, c.user_id, p.user_id AS post_owner, ${anoSQL(e, 'family_post_comments', 'c')} AS ano,
                c.content, ${tsSQL(e, 'family_post_comments', 'c', 'created_at')} AS ocorreu
           FROM family_post_comments c
           JOIN family_posts p ON p.id = c.post_id
          WHERE c.created_at IS NOT NULL
          ORDER BY c.id`,
      );
      for (const c of rows) {
        if (!comentarioValidoParaPontos(c.content)) continue;
        const uid = Number(c.user_id);
        const dono = Number(c.post_owner);
        marcarEdicao(uid, Number(c.ano));
        if (Number(c.ano) !== ano) continue;
        const iso = paraISO(c.ocorreu);
        if (!dentroDaJanela(iso) || !metricaDe(uid)) continue;

        const ref = `comentario:${c.id}`;
        const hora = relogioSP(new Date(iso)).hora;
        metaComentarioPorRef.set(`${uid}|${ref}`, {
          uid,
          dono,
          madrugada: hora >= 0 && hora < 5,
        });

        fatos.push({
          user_id: uid,
          origem: 'uso',
          regra: 'comentario',
          ref,
          pontos: 2,
          descricao: `Comentário no mural (${curtoDataSP(iso)})`,
          ocorreu_em: iso,
        });
      }
    })(),

    // 5) Reações no mural (1 por post por pessoa: ref = reacao:post:<post_id>)
    (async () => {
      if (!tem(e, 'family_post_reactions', 'id', 'post_id', 'user_id', 'created_at')
          || !tem(e, 'family_posts', 'id', 'user_id', 'created_at')) {
        return;
      }
      const { rows } = await q<{
        id: number;
        post_id: number;
        user_id: number;
        post_owner: number;
        post_ano: number;
        ocorreu: Date | string;
      }>(
        `SELECT r.id, r.post_id, r.user_id, p.user_id AS post_owner, ${anoSQL(e, 'family_posts', 'p')} AS post_ano,
                ${tsSQL(e, 'family_post_reactions', 'r', 'created_at')} AS ocorreu
           FROM family_post_reactions r
           JOIN family_posts p ON p.id = r.post_id
          WHERE r.created_at IS NOT NULL
          ORDER BY r.id`,
      );
      reacoesBrutas.push(...rows);
    })(),

    // 6) Advento: respostas, votos e aberturas
    (async () => {
      const [respRes, opensRes, votesRes] = await Promise.all([
        tem(e, 'advent_responses', 'id', 'ano', 'dia', 'user_id', 'created_at')
          ? q<{ id: number; dia: number; user_id: number; ocorreu: Date | string }>(
              `SELECT a.id, a.dia, a.user_id, ${tsSQL(e, 'advent_responses', 'a', 'created_at')} AS ocorreu
                 FROM advent_responses a
                WHERE a.ano = $1
                  AND ${tsSQL(e, 'advent_responses', 'a', 'created_at')} <= $2::timestamptz
                ORDER BY a.dia, a.id`,
              [ano, encerraIso],
            )
          : Promise.resolve({ rows: [] as { id: number; dia: number; user_id: number; ocorreu: Date | string }[] }),
        tem(e, 'advent_opens', 'ano', 'dia', 'user_id', 'opened_at')
          ? q<{ dia: number; user_id: number; ocorreu: Date | string }>(
              `SELECT o.dia, o.user_id, ${tsSQL(e, 'advent_opens', 'o', 'opened_at')} AS ocorreu
                 FROM advent_opens o
                WHERE o.ano = $1
                  AND ${tsSQL(e, 'advent_opens', 'o', 'opened_at')} <= $2::timestamptz`,
              [ano, encerraIso],
            )
          : Promise.resolve({ rows: [] as { dia: number; user_id: number; ocorreu: Date | string }[] }),
        tem(e, 'advent_votes', 'ano', 'dia', 'user_id')
          ? (
              tem(e, 'advent_votes', 'created_at')
                ? q<{ dia: number; user_id: number; ocorreu: Date | string | null }>(
                    `SELECT v.dia, v.user_id, ${tsSQL(e, 'advent_votes', 'v', 'created_at')} AS ocorreu
                       FROM advent_votes v
                      WHERE v.ano = $1
                        AND ${tsSQL(e, 'advent_votes', 'v', 'created_at')} <= $2::timestamptz
                      ORDER BY v.dia, v.user_id`,
                    [ano, encerraIso],
                  )
                : q<{ dia: number; user_id: number; ocorreu: Date | string | null }>(
                    `SELECT dia, user_id, NULL::timestamptz AS ocorreu
                       FROM advent_votes WHERE ano = $1 ORDER BY dia, user_id`,
                    [ano],
                  )
            )
          : Promise.resolve({ rows: [] as { dia: number; user_id: number; ocorreu: Date | string | null }[] }),
      ]);

      const adventoDiasPorUser = new Map<number, Set<number>>();
      const adventoPontualPorUser = new Map<number, Set<number>>();
      const marcarAdventoDia = (uid: number, dia: number, iso: string) => {
        const s = adventoDiasPorUser.get(uid) ?? new Set<number>();
        s.add(dia);
        adventoDiasPorUser.set(uid, s);
        const esperado = `${ano}-12-${String(dia).padStart(2, '0')}`;
        if (diaSPDeISO(iso) === esperado) {
          const sp = adventoPontualPorUser.get(uid) ?? new Set<number>();
          sp.add(dia);
          adventoPontualPorUser.set(uid, sp);
          if (dia === 1) {
            const m = metricaDe(uid);
            if (m) m.advento_dia_1_pontual = true;
          }
        }
      };

      const aberturasAdvento = new Map<string, string>();
      const abPorUser = new Map<number, Set<number>>();
      for (const r of opensRes.rows) {
        const uid = Number(r.user_id);
        const iso = paraISO(r.ocorreu);
        if (!dentroDaJanela(iso) || !metricaDe(uid)) continue;
        const dia = Number(r.dia);
        aberturasAdvento.set(`${uid}|${dia}`, iso);
        const sa = abPorUser.get(uid) ?? new Set<number>();
        sa.add(dia);
        abPorUser.set(uid, sa);
        const esperado = `${ano}-12-${String(dia).padStart(2, '0')}`;
        if (diaSPDeISO(iso) === esperado) {
          const sp = adventoPontualPorUser.get(uid) ?? new Set<number>();
          sp.add(dia);
          adventoPontualPorUser.set(uid, sp);
          if (dia === 1) metricaDe(uid)!.advento_dia_1_pontual = true;
        }
      }
      for (const [uid, sa] of abPorUser) {
        const m = metricaDe(uid);
        if (m) m.advento_aberturas = sa.size;
      }

      for (const r of respRes.rows) {
        const uid = Number(r.user_id);
        const iso = paraISO(r.ocorreu);
        if (!dentroDaJanela(iso) || !metricaDe(uid)) continue;
        marcarEdicao(uid, ano);
        const dia = Number(r.dia);
        marcarAdventoDia(uid, dia, iso);
        fatos.push({
          user_id: uid,
          origem: 'uso',
          regra: 'advento',
          ref: `advento:${dia}`,
          pontos: 15,
          descricao: `Respondeu a janela ${dia} do Advento`,
          ocorreu_em: iso,
        });
      }

      for (const r of votesRes.rows) {
        const uid = Number(r.user_id);
        if (!metricaDe(uid)) continue;
        const dia = Number(r.dia);
        const padraoDiaIso = new Date(`${ano}-12-${String(dia).padStart(2, '0')}T12:00:00-03:00`).toISOString();
        const iso = paraISO(r.ocorreu) ?? aberturasAdvento.get(`${uid}|${dia}`) ?? padraoDiaIso;
        if (!dentroDaJanela(iso)) continue;
        marcarEdicao(uid, ano);
        marcarAdventoDia(uid, dia, iso);
        fatos.push({
          user_id: uid,
          origem: 'uso',
          regra: 'advento_voto',
          ref: `advento_voto:${dia}`,
          pontos: 2,
          descricao: `Voto na janela ${dia} do Advento`,
          ocorreu_em: iso,
        });
      }

      for (const [uid, s] of adventoDiasPorUser) {
        const m = metricaDe(uid);
        if (m) m.advento_dias = s.size;
      }
      for (const [uid, s] of adventoPontualPorUser) {
        const m = metricaDe(uid);
        if (m) m.advento_no_dia = s.size;
      }
    })(),

    // 7) Presença na ceia, pratos, votações da ceia, playlist, desejos e dicas do amigo secreto
    (async () => {
      if (!tem(e, 'family_attendance', 'participant_id', 'user_id', 'status', 'created_at')
          || !tem(e, 'participants', 'id', 'user_id')) {
        return;
      }
      const colAno = tem(e, 'family_attendance', 'ano') ? 'a.ano' : 'NULL::int AS ano';
      const colUpd = tem(e, 'family_attendance', 'updated_at')
        ? `COALESCE(${tsSQL(e, 'family_attendance', 'a', 'updated_at')}, ${tsSQL(e, 'family_attendance', 'a', 'created_at')})`
        : tsSQL(e, 'family_attendance', 'a', 'created_at');
      const { rows } = await q<{ user_id: number | null; ano: number | null; ocorreu: Date | string }>(
        `SELECT COALESCE(a.user_id, p.user_id) AS user_id, ${colAno}, ${colUpd} AS ocorreu
           FROM family_attendance a
           JOIN participants p ON p.id = a.participant_id
          WHERE a.status = 'yes'`,
      );
      for (const r of rows) {
        if (r.user_id == null) continue;
        const uid = Number(r.user_id);
        const m = metricaDe(uid);
        if (!m) continue;
        const edRow = r.ano != null ? Number(r.ano) : ano;
        marcarEdicao(uid, edRow);
        if (r.ano != null && Number(r.ano) !== ano) continue;
        let iso = paraISO(r.ocorreu);
        if (!iso) continue;
        if (r.ano === ano && Date.parse(iso) < inicioMs) iso = inicioIso;
        if (!dentroDaJanela(iso)) continue;
        m.presenca_confirmada = true;
        fatos.push({
          user_id: uid,
          origem: 'uso',
          regra: 'presenca',
          ref: `presenca:${ano}`,
          pontos: 30,
          descricao: 'Confirmou presença na ceia',
          ocorreu_em: iso,
        });
      }
    })(),

    (async () => {
      if (!tem(e, 'ceia_dishes', 'id', 'ano', 'user_id', 'created_at')) return;
      const colResp = tem(e, 'ceia_dishes', 'responsavel_id') ? 'COALESCE(d.responsavel_id, d.user_id)' : 'd.user_id';
      const { rows } = await q<{ uid: number; ocorreu: Date | string }>(
        `SELECT ${colResp} AS uid, ${tsSQL(e, 'ceia_dishes', 'd', 'created_at')} AS ocorreu
           FROM ceia_dishes d
          WHERE d.ano = $1
            AND ${tsSQL(e, 'ceia_dishes', 'd', 'created_at')} <= $2::timestamptz`,
        [ano, encerraIso],
      );
      for (const r of rows) {
        const iso = paraISO(r.ocorreu);
        const m = metricaDe(Number(r.uid));
        if (m && dentroDaJanela(iso)) m.pratos_ceia++;
      }
    })(),

    (async () => {
      if (!tem(e, 'ceia_votos', 'id', 'ano', 'user_id', 'created_at')) return;
      const { rows } = await q<{ user_id: number; ocorreu: Date | string }>(
        `SELECT v.user_id, ${tsSQL(e, 'ceia_votos', 'v', 'created_at')} AS ocorreu
           FROM ceia_votos v
          WHERE v.ano = $1
            AND ${tsSQL(e, 'ceia_votos', 'v', 'created_at')} <= $2::timestamptz`,
        [ano, encerraIso],
      );
      for (const r of rows) {
        const iso = paraISO(r.ocorreu);
        const m = metricaDe(Number(r.user_id));
        if (m && dentroDaJanela(iso)) m.votos_ceia++;
      }
    })(),

    (async () => {
      if (!tem(e, 'playlist_tracks', 'id', 'ano', 'user_id', 'created_at')) return;
      const { rows } = await q<{ user_id: number; ocorreu: Date | string }>(
        `SELECT t.user_id, ${tsSQL(e, 'playlist_tracks', 't', 'created_at')} AS ocorreu
           FROM playlist_tracks t
          WHERE t.ano = $1
            AND ${tsSQL(e, 'playlist_tracks', 't', 'created_at')} <= $2::timestamptz`,
        [ano, encerraIso],
      );
      for (const r of rows) {
        const iso = paraISO(r.ocorreu);
        const m = metricaDe(Number(r.user_id));
        if (m && dentroDaJanela(iso)) m.musicas_playlist++;
      }
    })(),

    (async () => {
      if (!tem(e, 'secret_santa_hints', 'id', 'ano', 'user_id', 'created_at')) return;
      const { rows } = await q<{ user_id: number; ocorreu: Date | string }>(
        `SELECT h.user_id, ${tsSQL(e, 'secret_santa_hints', 'h', 'created_at')} AS ocorreu
           FROM secret_santa_hints h
          WHERE h.ano = $1
            AND ${tsSQL(e, 'secret_santa_hints', 'h', 'created_at')} <= $2::timestamptz`,
        [ano, encerraIso],
      );
      for (const r of rows) {
        const iso = paraISO(r.ocorreu);
        const m = metricaDe(Number(r.user_id));
        if (m && dentroDaJanela(iso)) m.dicas_amigo++;
      }
    })(),

    (async () => {
      if (!tem(e, 'wish_list', 'id', 'participant_id', 'item_name', 'created_at')
          || !tem(e, 'participants', 'id', 'user_id')) {
        return;
      }
      const filtroAno = tem(e, 'wish_list', 'ano') ? 'AND w.ano = $2' : '';
      const params = tem(e, 'wish_list', 'ano') ? [encerraIso, ano] : [encerraIso];
      const { rows } = await q<{ id: number; user_id: number; item_name: string; ocorreu: Date | string }>(
        `SELECT w.id, p.user_id, w.item_name, ${tsSQL(e, 'wish_list', 'w', 'created_at')} AS ocorreu
           FROM wish_list w
           JOIN participants p ON p.id = w.participant_id
          WHERE p.user_id IS NOT NULL
            AND ${tsSQL(e, 'wish_list', 'w', 'created_at')} <= $1::timestamptz
            ${filtroAno}
          ORDER BY w.id`,
        params,
      );
      for (const r of rows) {
        const uid = Number(r.user_id);
        const iso = paraISO(r.ocorreu);
        if (!metricaDe(uid) || !dentroDaJanela(iso)) continue;
        fatos.push({
          user_id: uid,
          origem: 'uso',
          regra: 'desejo',
          ref: `desejo:${r.id}`,
          pontos: 5,
          descricao: `Item na lista de desejos (${curtoDataSP(iso)})`,
          ocorreu_em: iso,
        });
      }
    })(),

    // 8) Memórias: receitas, histórias, cápsulas, homenagens, velas e árvore
    (async () => {
      if (!tem(e, 'family_recipes', 'id', 'ano', 'user_id', 'titulo', 'created_at')) return;
      const { rows } = await q<{ id: number; user_id: number; titulo: string; ocorreu: Date | string }>(
        `SELECT r.id, r.user_id, r.titulo, ${tsSQL(e, 'family_recipes', 'r', 'created_at')} AS ocorreu
           FROM family_recipes r
          WHERE r.ano = $1
            AND ${tsSQL(e, 'family_recipes', 'r', 'created_at')} <= $2::timestamptz
          ORDER BY r.id`,
        [ano, encerraIso],
      );
      for (const r of rows) {
        const uid = Number(r.user_id);
        const iso = paraISO(r.ocorreu);
        if (!metricaDe(uid) || !dentroDaJanela(iso)) continue;
        fatos.push({
          user_id: uid,
          origem: 'uso',
          regra: 'receita',
          ref: `receita:${r.id}`,
          pontos: 20,
          descricao: `Receita de família: ${resumir(r.titulo, 40)}`,
          ocorreu_em: iso,
        });
      }
    })(),

    (async () => {
      if (!tem(e, 'family_stories', 'id', 'ano', 'user_id', 'titulo', 'created_at')) return;
      const { rows } = await q<{ id: number; user_id: number; titulo: string; ocorreu: Date | string }>(
        `SELECT s.id, s.user_id, s.titulo, ${tsSQL(e, 'family_stories', 's', 'created_at')} AS ocorreu
           FROM family_stories s
          WHERE s.ano = $1
            AND ${tsSQL(e, 'family_stories', 's', 'created_at')} <= $2::timestamptz
          ORDER BY s.id`,
        [ano, encerraIso],
      );
      for (const r of rows) {
        const uid = Number(r.user_id);
        const iso = paraISO(r.ocorreu);
        if (!metricaDe(uid) || !dentroDaJanela(iso)) continue;
        fatos.push({
          user_id: uid,
          origem: 'uso',
          regra: 'historia',
          ref: `historia:${r.id}`,
          pontos: 20,
          descricao: `História da família: ${resumir(r.titulo, 40)}`,
          ocorreu_em: iso,
        });
      }
    })(),

    // Nunca selecionar texto_lacrado de time_capsules!
    (async () => {
      if (!tem(e, 'time_capsules', 'id', 'ano', 'user_id', 'created_at')) return;
      const colPara = tem(e, 'time_capsules', 'para_user_id') ? 'c.para_user_id' : 'NULL::int AS para_user_id';
      const { rows } = await q<{ id: number; user_id: number; para_user_id: number | null; ocorreu: Date | string }>(
        `SELECT c.id, c.user_id, ${colPara}, ${tsSQL(e, 'time_capsules', 'c', 'created_at')} AS ocorreu
           FROM time_capsules c
          WHERE c.ano = $1
            AND ${tsSQL(e, 'time_capsules', 'c', 'created_at')} <= $2::timestamptz
          ORDER BY c.id`,
        [ano, encerraIso],
      );
      for (const r of rows) {
        const uid = Number(r.user_id);
        const iso = paraISO(r.ocorreu);
        if (!metricaDe(uid) || !dentroDaJanela(iso)) continue;
        const ref = `capsula:${r.id}`;
        metaCapsulaPorRef.set(`${uid}|${ref}`, {
          uid,
          destinatario: r.para_user_id != null && Number(r.para_user_id) !== uid ? Number(r.para_user_id) : null,
        });
        fatos.push({
          user_id: uid,
          origem: 'uso',
          regra: 'capsula',
          ref,
          pontos: 20,
          descricao: `Cápsula do tempo lacrada (${curtoDataSP(iso)})`,
          ocorreu_em: iso,
        });
      }
    })(),

    (async () => {
      if (!tem(e, 'family_tributes', 'id', 'ano', 'user_id', 'created_at')) return;
      const { rows } = await q<{ id: number; user_id: number; ocorreu: Date | string }>(
        `SELECT t.id, t.user_id, ${tsSQL(e, 'family_tributes', 't', 'created_at')} AS ocorreu
           FROM family_tributes t
          WHERE t.ano = $1
            AND ${tsSQL(e, 'family_tributes', 't', 'created_at')} <= $2::timestamptz
          ORDER BY t.id`,
        [ano, encerraIso],
      );
      for (const r of rows) {
        const uid = Number(r.user_id);
        const iso = paraISO(r.ocorreu);
        if (!metricaDe(uid) || !dentroDaJanela(iso)) continue;
        fatos.push({
          user_id: uid,
          origem: 'uso',
          regra: 'homenagem',
          ref: `homenagem:${r.id}`,
          pontos: 15,
          descricao: `Homenagem publicada (${curtoDataSP(iso)})`,
          ocorreu_em: iso,
        });
      }
    })(),

    (async () => {
      if (!tem(e, 'family_memorial_candles', 'id', 'ano', 'user_id', 'created_at')) return;
      const { rows } = await q<{ user_id: number; ocorreu: Date | string }>(
        `SELECT v.user_id, ${tsSQL(e, 'family_memorial_candles', 'v', 'created_at')} AS ocorreu
           FROM family_memorial_candles v
          WHERE v.ano = $1
            AND ${tsSQL(e, 'family_memorial_candles', 'v', 'created_at')} <= $2::timestamptz`,
        [ano, encerraIso],
      );
      for (const r of rows) {
        const iso = paraISO(r.ocorreu);
        const m = metricaDe(Number(r.user_id));
        if (m && dentroDaJanela(iso)) m.velas_acesas++;
      }
    })(),

    (async () => {
      if (!tem(e, 'family_tree_people', 'id', 'nome', 'criado_por', 'created_at')) return;
      const { rows } = await q<{ id: number; nome: string; criado_por: number; ocorreu: Date | string }>(
        `SELECT p.id, p.nome, p.criado_por, ${tsSQL(e, 'family_tree_people', 'p', 'created_at')} AS ocorreu
           FROM family_tree_people p
          WHERE p.criado_por IS NOT NULL
            AND ${tsSQL(e, 'family_tree_people', 'p', 'created_at')} <= $1::timestamptz
          ORDER BY p.id`,
        [encerraIso],
      );
      for (const r of rows) {
        const uid = Number(r.criado_por);
        const iso = paraISO(r.ocorreu);
        if (!metricaDe(uid) || !dentroDaJanela(iso)) continue;
        fatos.push({
          user_id: uid,
          origem: 'uso',
          regra: 'arvore',
          ref: `arvore:${r.id}`,
          pontos: 3,
          descricao: `Pessoa adicionada na árvore: ${resumir(r.nome, 36)}`,
          ocorreu_em: iso,
        });
      }
    })(),

    (async () => {
      if (!tem(e, 'family_tree_links', 'id', 'criado_por', 'created_at')) return;
      const { rows } = await q<{ criado_por: number; ocorreu: Date | string }>(
        `SELECT l.criado_por, ${tsSQL(e, 'family_tree_links', 'l', 'created_at')} AS ocorreu
           FROM family_tree_links l
          WHERE l.criado_por IS NOT NULL
            AND ${tsSQL(e, 'family_tree_links', 'l', 'created_at')} <= $1::timestamptz`,
        [encerraIso],
      );
      for (const r of rows) {
        const iso = paraISO(r.ocorreu);
        const m = metricaDe(Number(r.criado_por));
        if (m && dentroDaJanela(iso)) m.elos_arvore++;
      }
    })(),

    // 9) Brincadeiras da festa: Quiz, Bingo, Desafios de Foto, Enquetes e Jogos Novos
    (async () => {
      if (!tem(e, 'party_quiz_answers', 'ano', 'question_id', 'user_id', 'acertou', 'pontos', 'tempo_ms', 'created_at')
          || !tem(e, 'party_quiz_questions', 'id', 'ano', 'encerrada')) {
        return;
      }
      const colEnc = tem(e, 'party_quiz_state', 'encerrada_em')
        ? `COALESCE(${tsSQL(e, 'party_quiz_state', 's', 'encerrada_em')}, ${tsSQL(e, 'party_quiz_state', 's', 'updated_at')})`
        : tsSQL(e, 'party_quiz_state', 's', 'updated_at');

      const [ansRes, stRes] = await Promise.all([
        q<{
          question_id: number;
          user_id: number;
          acertou: boolean;
          pontos: number;
          tempo_ms: number;
          ocorreu: Date | string;
        }>(
          `SELECT a.question_id, a.user_id, a.acertou, a.pontos, a.tempo_ms,
                  ${tsSQL(e, 'party_quiz_answers', 'a', 'created_at')} AS ocorreu
             FROM party_quiz_answers a
             JOIN party_quiz_questions q ON q.id = a.question_id AND q.ano = a.ano
            WHERE a.ano = $1 AND q.encerrada = true
              AND ${tsSQL(e, 'party_quiz_answers', 'a', 'created_at')} <= $2::timestamptz
            ORDER BY a.question_id, a.id`,
          [ano, encerraIso],
        ),
        tem(e, 'party_quiz_state', 'ano', 'status', 'updated_at')
          ? q<{ status: string; ocorreu: Date | string }>(
              `SELECT s.status, ${colEnc} AS ocorreu FROM party_quiz_state s WHERE s.ano = $1`,
              [ano],
            )
          : Promise.resolve({ rows: [] as { status: string; ocorreu: Date | string }[] }),
      ]);

      const placarQuiz = new Map<number, { pontos: number; acertos: number; somaTempo: number; qtd: number; ultimoIso: string }>();
      for (const r of ansRes.rows) {
        const uid = Number(r.user_id);
        const iso = paraISO(r.ocorreu);
        const m = metricaDe(uid);
        if (!m || !dentroDaJanela(iso)) continue;
        m.quiz_respostas++;
        const st = placarQuiz.get(uid) ?? { pontos: 0, acertos: 0, somaTempo: 0, qtd: 0, ultimoIso: iso };
        st.pontos += Number(r.pontos);
        st.somaTempo += Number(r.tempo_ms);
        st.qtd++;
        if (Date.parse(iso) > Date.parse(st.ultimoIso)) st.ultimoIso = iso;
        if (r.acertou) {
          m.quiz_acertos++;
          st.acertos++;
          fatos.push({
            user_id: uid,
            origem: 'brincadeira',
            regra: 'quiz_acerto',
            ref: `quiz_acerto:${r.question_id}`,
            pontos: 5,
            descricao: 'Acertou pergunta do Quiz da Família',
            ocorreu_em: iso,
          });
        }
        placarQuiz.set(uid, st);
      }

      if (stRes.rows[0]?.status === 'podio') {
        const isoPodio = paraISO(stRes.rows[0].ocorreu);
        const ordenado = [...placarQuiz.entries()]
          .filter(([, v]) => v.pontos > 0)
          .sort((a, b) => (
            b[1].pontos - a[1].pontos
            || b[1].acertos - a[1].acertos
            || Math.round(a[1].somaTempo / a[1].qtd) - Math.round(b[1].somaTempo / b[1].qtd)
            || a[0] - b[0]
          ))
          .slice(0, 3);
        const premiosPodio = [50, 30, 20];
        ordenado.forEach(([uid, v], idx) => {
          const iso = isoPodio && dentroDaJanela(isoPodio) ? isoPodio : v.ultimoIso;
          if (!dentroDaJanela(iso)) return;
          const m = metricaDe(uid);
          if (m) {
            m.quiz_podio = true;
            if (idx === 0) m.quiz_primeiro = true;
          }
          fatos.push({
            user_id: uid,
            origem: 'brincadeira',
            regra: 'quiz_podio',
            ref: `quiz_podio:${idx + 1}`,
            pontos: premiosPodio[idx],
            descricao: `${idx + 1}º lugar no Quiz da Família`,
            ocorreu_em: iso,
          });
        });
      }
    })(),

    (async () => {
      if (!tem(e, 'party_bingo_marks', 'ano', 'user_id', 'created_at')) return;
      const { rows } = await q<{ user_id: number; ocorreu: Date | string }>(
        `SELECT m.user_id, ${tsSQL(e, 'party_bingo_marks', 'm', 'created_at')} AS ocorreu
           FROM party_bingo_marks m
          WHERE m.ano = $1
            AND ${tsSQL(e, 'party_bingo_marks', 'm', 'created_at')} <= $2::timestamptz`,
        [ano, encerraIso],
      );
      for (const r of rows) {
        const iso = paraISO(r.ocorreu);
        const m = metricaDe(Number(r.user_id));
        if (m && dentroDaJanela(iso)) m.bingo_marcacoes++;
      }
    })(),

    (async () => {
      if (!tem(e, 'party_bingo_claims', 'id', 'ano', 'user_id', 'padrao', 'status', 'created_at')) return;
      const colConf = tem(e, 'party_bingo_claims', 'confirmed_at')
        ? `COALESCE(${tsSQL(e, 'party_bingo_claims', 'c', 'confirmed_at')}, ${tsSQL(e, 'party_bingo_claims', 'c', 'created_at')})`
        : tsSQL(e, 'party_bingo_claims', 'c', 'created_at');
      const { rows } = await q<{ id: number; user_id: number; padrao: string; ocorreu: Date | string }>(
        `SELECT c.id, c.user_id, c.padrao, ${colConf} AS ocorreu
           FROM party_bingo_claims c
          WHERE c.ano = $1 AND c.status = 'confirmado'
            AND ${colConf} <= $2::timestamptz
          ORDER BY c.id`,
        [ano, encerraIso],
      );
      for (const r of rows) {
        const uid = Number(r.user_id);
        const iso = paraISO(r.ocorreu);
        const m = metricaDe(uid);
        if (!m || !dentroDaJanela(iso)) continue;
        m.bingo_vitorias++;
        fatos.push({
          user_id: uid,
          origem: 'brincadeira',
          regra: 'bingo',
          ref: `bingo:${r.id}`,
          pontos: 40,
          descricao: `Bingo confirmado (${resumir(r.padrao, 30)})`,
          ocorreu_em: iso,
        });
      }
    })(),

    (async () => {
      if (!tem(e, 'party_challenges', 'id', 'ano', 'titulo', 'aberto')
          || !tem(e, 'party_photo_entries', 'id', 'ano', 'desafio_id', 'user_id', 'created_at')) {
        return;
      }
      const temVotos = tem(e, 'party_photo_votes', 'entry_id');
      const colEnc = tem(e, 'party_challenges', 'encerrado_em')
        ? tsSQL(e, 'party_challenges', 'c', 'encerrado_em')
        : 'NULL::timestamptz';
      const sqlVotos = temVotos
        ? (
            tem(e, 'party_photo_votes', 'created_at')
              ? `(SELECT COUNT(*)::int FROM party_photo_votes v WHERE v.entry_id = e.id AND ${tsSQL(e, 'party_photo_votes', 'v', 'created_at')} <= $2::timestamptz)`
              : `(SELECT COUNT(*)::int FROM party_photo_votes v WHERE v.entry_id = e.id)`
          )
        : '0::int';
      const { rows } = await q<{
        id: number;
        desafio_id: number;
        user_id: number;
        titulo: string;
        aberto: boolean;
        votos: number;
        ocorreu: Date | string;
        encerrado: Date | string | null;
      }>(
        `SELECT e.id, e.desafio_id, e.user_id, c.titulo, c.aberto, ${sqlVotos} AS votos,
                ${tsSQL(e, 'party_photo_entries', 'e', 'created_at')} AS ocorreu,
                ${colEnc} AS encerrado
           FROM party_photo_entries e
           JOIN party_challenges c ON c.id = e.desafio_id AND c.ano = e.ano
          WHERE e.ano = $1
            AND ${tsSQL(e, 'party_photo_entries', 'e', 'created_at')} <= $2::timestamptz
          ORDER BY e.id`,
        [ano, encerraIso],
      );
      const maxVotosPorDesafio = new Map<number, number>();
      for (const r of rows) {
        const atual = maxVotosPorDesafio.get(Number(r.desafio_id)) ?? 0;
        if (Number(r.votos) > atual) maxVotosPorDesafio.set(Number(r.desafio_id), Number(r.votos));
      }
      for (const r of rows) {
        const uid = Number(r.user_id);
        const iso = paraISO(r.ocorreu);
        const m = metricaDe(uid);
        if (!m || !dentroDaJanela(iso)) continue;
        m.desafio_fotos++;
        fatos.push({
          user_id: uid,
          origem: 'brincadeira',
          regra: 'desafio_foto',
          ref: `desafio_foto:${r.desafio_id}`,
          pontos: 10,
          descricao: `Foto no desafio: ${resumir(r.titulo, 36)}`,
          ocorreu_em: iso,
        });

        const maior = maxVotosPorDesafio.get(Number(r.desafio_id)) ?? 0;
        if (!r.aberto && maior > 0 && Number(r.votos) === maior) {
          const isoVenc = paraISO(r.encerrado) ?? iso;
          if (dentroDaJanela(isoVenc)) {
            m.desafio_vitorias++;
            fatos.push({
              user_id: uid,
              origem: 'brincadeira',
              regra: 'desafio_vencedor',
              ref: `desafio_vencedor:${r.desafio_id}`,
              pontos: 40,
              descricao: `Foto vencedora do desafio: ${resumir(r.titulo, 32)}`,
              ocorreu_em: isoVenc,
            });
          }
        }
      }
    })(),

    (async () => {
      if (!tem(e, 'party_live_poll_votes', 'ano', 'poll_id', 'user_id', 'updated_at')) return;
      const { rows } = await q<{ poll_id: number; user_id: number; ocorreu: Date | string }>(
        `SELECT v.poll_id, v.user_id, ${tsSQL(e, 'party_live_poll_votes', 'v', 'updated_at')} AS ocorreu
           FROM party_live_poll_votes v
          WHERE v.ano = $1
            AND ${tsSQL(e, 'party_live_poll_votes', 'v', 'updated_at')} <= $2::timestamptz
          ORDER BY v.poll_id, v.user_id`,
        [ano, encerraIso],
      );
      for (const r of rows) {
        const uid = Number(r.user_id);
        const iso = paraISO(r.ocorreu);
        const m = metricaDe(uid);
        if (!m || !dentroDaJanela(iso)) continue;
        m.enquetes_ao_vivo_votos++;
        fatos.push({
          user_id: uid,
          origem: 'brincadeira',
          regra: 'enquete',
          ref: `enquete_ao_vivo:${r.poll_id}`,
          pontos: 2,
          descricao: `Voto em enquete ao vivo (${curtoDataSP(iso)})`,
          ocorreu_em: iso,
        });
      }
    })(),

    (async () => {
      if (!tem(e, 'family_poll_votes', 'poll_id', 'user_id', 'created_at')) return;
      const { rows } = await q<{ poll_id: number; user_id: number; ocorreu: Date | string }>(
        `SELECT v.poll_id, v.user_id, ${tsSQL(e, 'family_poll_votes', 'v', 'created_at')} AS ocorreu
           FROM family_poll_votes v
          WHERE ${tsSQL(e, 'family_poll_votes', 'v', 'created_at')} <= $1::timestamptz
          ORDER BY v.poll_id, v.user_id`,
        [encerraIso],
      );
      for (const r of rows) {
        const uid = Number(r.user_id);
        const iso = paraISO(r.ocorreu);
        const m = metricaDe(uid);
        if (!m || !dentroDaJanela(iso)) continue;
        m.enquetes_mural_votos++;
        fatos.push({
          user_id: uid,
          origem: 'brincadeira',
          regra: 'enquete',
          ref: `enquete_mural:${r.poll_id}`,
          pontos: 2,
          descricao: `Voto em enquete do mural (${curtoDataSP(iso)})`,
          ocorreu_em: iso,
        });
      }
    })(),

    (async () => {
      if (!tem(e, 'party_mimica', 'id', 'ano', 'quem_joga', 'status', 'created_at')) return;
      const colFim = tem(e, 'party_mimica', 'encerrado_em')
        ? `COALESCE(${tsSQL(e, 'party_mimica', 'm', 'encerrado_em')}, ${tsSQL(e, 'party_mimica', 'm', 'created_at')})`
        : tsSQL(e, 'party_mimica', 'm', 'created_at');
      const { rows } = await q<{ id: string | number; quem_joga: number; status: string; ocorreu: Date | string }>(
        `SELECT m.id, m.quem_joga, m.status, ${colFim} AS ocorreu
           FROM party_mimica m
          WHERE m.ano = $1 AND m.quem_joga IS NOT NULL AND m.status IN ('acertou', 'tempo')
            AND ${colFim} <= $2::timestamptz
          ORDER BY m.id`,
        [ano, encerraIso],
      );
      for (const r of rows) {
        const uid = Number(r.quem_joga);
        const iso = paraISO(r.ocorreu);
        const m = metricaDe(uid);
        if (!m || !dentroDaJanela(iso)) continue;
        m.jogos_participacoes++;
        fatos.push({
          user_id: uid,
          origem: 'brincadeira',
          regra: 'jogo_mimica',
          ref: `mimica_part:${r.id}`,
          pontos: 5,
          descricao: 'Participou da Mímica/Desenho',
          ocorreu_em: iso,
        });
        if (r.status === 'acertou') {
          m.jogos_vitorias++;
          fatos.push({
            user_id: uid,
            origem: 'brincadeira',
            regra: 'jogo_mimica',
            ref: `mimica_vit:${r.id}`,
            pontos: 30,
            descricao: 'Venceu rodada da Mímica/Desenho',
            ocorreu_em: iso,
          });
        }
      }
    })(),

    (async () => {
      if (!tem(e, 'party_bebe', 'id', 'ano', 'resposta_user_id', 'status')
          || !tem(e, 'party_bebe_votos', 'bebe_id', 'user_id', 'palpite_user_id', 'updated_at')) {
        return;
      }
      const colRev = tem(e, 'party_bebe', 'revelada_em')
        ? `COALESCE(${tsSQL(e, 'party_bebe', 'b', 'revelada_em')}, ${tsSQL(e, 'party_bebe_votos', 'v', 'updated_at')})`
        : tsSQL(e, 'party_bebe_votos', 'v', 'updated_at');
      const { rows } = await q<{
        bebe_id: string | number;
        user_id: number;
        acertou: boolean;
        ocorreu: Date | string;
      }>(
        `SELECT b.id AS bebe_id, v.user_id, (v.palpite_user_id = b.resposta_user_id) AS acertou,
                ${colRev} AS ocorreu
           FROM party_bebe_votos v
           JOIN party_bebe b ON b.id = v.bebe_id
          WHERE b.ano = $1 AND b.status = 'revelada'
            AND ${colRev} <= $2::timestamptz
          ORDER BY b.id, v.user_id`,
        [ano, encerraIso],
      );
      for (const r of rows) {
        const uid = Number(r.user_id);
        const iso = paraISO(r.ocorreu);
        const m = metricaDe(uid);
        if (!m || !dentroDaJanela(iso)) continue;
        m.jogos_participacoes++;
        fatos.push({
          user_id: uid,
          origem: 'brincadeira',
          regra: 'jogo_bebe',
          ref: `bebe_part:${r.bebe_id}`,
          pontos: 5,
          descricao: 'Participou do Quem é o Bebê?',
          ocorreu_em: iso,
        });
        if (r.acertou) {
          m.jogos_vitorias++;
          fatos.push({
            user_id: uid,
            origem: 'brincadeira',
            regra: 'jogo_bebe',
            ref: `bebe_vit:${r.bebe_id}`,
            pontos: 30,
            descricao: 'Acertou no Quem é o Bebê?',
            ocorreu_em: iso,
          });
        }
      }
    })(),

    (async () => {
      if (!tem(e, 'party_roleta', 'id', 'ano', 'participantes', 'girado_em')) return;
      const colSort = tem(e, 'party_roleta', 'sorteado_user_id') ? 'r.sorteado_user_id' : 'NULL::int AS sorteado_user_id';
      const { rows } = await q<{
        id: string | number;
        participantes: unknown;
        sorteado_user_id: number | null;
        ocorreu: Date | string;
      }>(
        `SELECT r.id, r.participantes, ${colSort}, ${tsSQL(e, 'party_roleta', 'r', 'girado_em')} AS ocorreu
           FROM party_roleta r
          WHERE r.ano = $1 AND r.girado_em IS NOT NULL
            AND ${tsSQL(e, 'party_roleta', 'r', 'girado_em')} <= $2::timestamptz
          ORDER BY r.id`,
        [ano, encerraIso],
      );
      for (const r of rows) {
        const iso = paraISO(r.ocorreu);
        if (!dentroDaJanela(iso)) continue;
        const lista = new Set<number>();
        if (Array.isArray(r.participantes)) {
          for (const item of r.participantes) {
            const n = Number(item);
            if (Number.isInteger(n) && n > 0) lista.add(n);
          }
        }
        if (r.sorteado_user_id != null) lista.add(Number(r.sorteado_user_id));
        for (const uid of lista) {
          const m = metricaDe(uid);
          if (!m) continue;
          m.jogos_participacoes++;
          fatos.push({
            user_id: uid,
            origem: 'brincadeira',
            regra: 'jogo_roleta',
            ref: `roleta_part:${r.id}`,
            pontos: 5,
            descricao: 'Participou da Roleta de Prendas',
            ocorreu_em: iso,
          });
        }
      }
    })(),

    (async () => {
      if (!tem(e, 'party_teams', 'id', 'ano', 'pontos', 'created_at')
          || !tem(e, 'party_team_members', 'ano', 'team_id', 'user_id')) {
        return;
      }
      const { rows } = await q<{
        team_id: number;
        user_id: number;
        pontos: number;
        ocorreu: Date | string;
      }>(
        `SELECT t.id AS team_id, tm.user_id, t.pontos, ${tsSQL(e, 'party_teams', 't', 'created_at')} AS ocorreu
           FROM party_team_members tm
           JOIN party_teams t ON t.id = tm.team_id AND t.ano = tm.ano
          WHERE tm.ano = $1
            AND ${tsSQL(e, 'party_teams', 't', 'created_at')} <= $2::timestamptz
          ORDER BY t.id, tm.user_id`,
        [ano, encerraIso],
      );
      let maiorTimePts = 0;
      for (const r of rows) {
        if (Number(r.pontos) > maiorTimePts) maiorTimePts = Number(r.pontos);
      }
      for (const r of rows) {
        const uid = Number(r.user_id);
        const iso = paraISO(r.ocorreu);
        const m = metricaDe(uid);
        if (!m || !dentroDaJanela(iso)) continue;
        m.jogos_participacoes++;
        fatos.push({
          user_id: uid,
          origem: 'brincadeira',
          regra: 'jogo_times',
          ref: `times_part:${r.team_id}`,
          pontos: 5,
          descricao: 'Entrou na Batalha de Times',
          ocorreu_em: iso,
        });
        if (maiorTimePts > 0 && Number(r.pontos) === maiorTimePts) {
          m.jogos_vitorias++;
          fatos.push({
            user_id: uid,
            origem: 'brincadeira',
            regra: 'jogo_times',
            ref: `times_vit:${r.team_id}`,
            pontos: 30,
            descricao: 'Venceu na Batalha de Times',
            ocorreu_em: iso,
          });
        }
      }
    })(),

    // 10) Karaokê: apresentações (solo + dueto), batalhas e tentativas avulsas da prova
    (async () => {
      const temFila = tem(e, 'karaoke_fila', 'id', 'ano', 'user_id', 'video_id', 'titulo', 'status', 'created_at')
        && tem(e, 'karaoke_notas', 'fila_id', 'nota');
      const temProva = tem(e, 'karaoke_prova_tentativas', 'id', 'ano', 'user_id', 'catalogo_id', 'nota', 'status', 'iniciada_em');
      if (!temFila && !temProva) return;

      const colDueto = tem(e, 'karaoke_fila', 'dueto_user_id') ? 'f.dueto_user_id' : 'NULL::int AS dueto_user_id';
      const colCat = tem(e, 'karaoke_fila', 'catalogo_id') ? 'f.catalogo_id' : 'NULL::bigint AS catalogo_id';
      const colLrc = tem(e, 'karaoke_fila', 'lrclib_id') ? 'f.lrclib_id' : 'NULL::bigint AS lrclib_id';
      const colDet = tem(e, 'karaoke_notas', 'detalhes') ? 'n.detalhes' : 'NULL::jsonb AS detalhes';
      const colBat = tem(e, 'karaoke_fila', 'batalha_id') ? 'f.batalha_id::text AS batalha_id' : 'NULL::text AS batalha_id';
      const colRod = tem(e, 'karaoke_fila', 'batalha_rodada') ? 'f.batalha_rodada' : 'NULL::smallint AS batalha_rodada';
      const colLinhas = tem(e, 'karaoke_fila', 'notas_linhas') ? 'f.notas_linhas' : 'NULL::jsonb AS notas_linhas';
      const exprOcorreu = [
        tem(e, 'karaoke_fila', 'terminado_em') ? tsSQL(e, 'karaoke_fila', 'f', 'terminado_em') : null,
        tem(e, 'karaoke_fila', 'iniciado_em') ? tsSQL(e, 'karaoke_fila', 'f', 'iniciado_em') : null,
        tsSQL(e, 'karaoke_fila', 'f', 'created_at'),
      ].filter(Boolean).join(', ');

      const colFila = tem(e, 'karaoke_prova_tentativas', 'fila_id') ? 't.fila_id' : 'NULL::bigint AS fila_id';
      const colTerm = tem(e, 'karaoke_prova_tentativas', 'terminada_em')
        ? `COALESCE(${tsSQL(e, 'karaoke_prova_tentativas', 't', 'terminada_em')}, ${tsSQL(e, 'karaoke_prova_tentativas', 't', 'iniciada_em')})`
        : tsSQL(e, 'karaoke_prova_tentativas', 't', 'iniciada_em');
      const joinCat = tem(e, 'karaoke_catalogo', 'id', 'faixa')
        ? 'LEFT JOIN karaoke_catalogo c ON c.id = t.catalogo_id'
        : '';
      const colTit = tem(e, 'karaoke_catalogo', 'id', 'faixa') ? 'COALESCE(c.faixa, \'Prova do Karaokê\')' : '\'Prova do Karaokê\'';

      const [filaRes, provaRes] = await Promise.all([
        temFila
          ? q<{
              id: string | number;
              user_id: number;
              dueto_user_id: number | null;
              video_id: string;
              catalogo_id: string | number | null;
              lrclib_id: string | number | null;
              titulo: string;
              nota: number;
              detalhes: { nivel?: string; maiorCombo?: number } | null;
              batalha_id: string | null;
              batalha_rodada: number | null;
              notas_linhas: unknown;
              ocorreu: Date | string;
            }>(
              `SELECT f.id, f.user_id, ${colDueto}, f.video_id, ${colCat}, ${colLrc}, f.titulo,
                      n.nota, ${colDet}, ${colBat}, ${colRod}, ${colLinhas},
                      COALESCE(${exprOcorreu}) AS ocorreu
                 FROM karaoke_fila f
                 JOIN karaoke_notas n ON n.fila_id = f.id
                WHERE f.ano = $1 AND f.status = 'feita'
                  AND COALESCE(${exprOcorreu}) <= $2::timestamptz
                ORDER BY f.id`,
              [ano, encerraIso],
            )
          : Promise.resolve({ rows: [] as {
              id: string | number;
              user_id: number;
              dueto_user_id: number | null;
              video_id: string;
              catalogo_id: string | number | null;
              lrclib_id: string | number | null;
              titulo: string;
              nota: number;
              detalhes: { nivel?: string; maiorCombo?: number } | null;
              batalha_id: string | null;
              batalha_rodada: number | null;
              notas_linhas: unknown;
              ocorreu: Date | string;
            }[] }),
        temProva
          ? q<{
              id: string | number;
              fila_id: string | number | null;
              user_id: number;
              catalogo_id: string | number;
              titulo: string;
              nota: number;
              ocorreu: Date | string;
            }>(
              `SELECT t.id, ${colFila}, t.user_id, t.catalogo_id, ${colTit} AS titulo, t.nota, ${colTerm} AS ocorreu
                 FROM karaoke_prova_tentativas t
                 ${joinCat}
                WHERE t.ano = $1 AND t.nota IS NOT NULL AND t.status IN ('valida', 'abandonada')
                  AND ${colTerm} <= $2::timestamptz
                ORDER BY t.id`,
              [ano, encerraIso],
            )
          : Promise.resolve({ rows: [] as {
              id: string | number;
              fila_id: string | number | null;
              user_id: number;
              catalogo_id: string | number;
              titulo: string;
              nota: number;
              ocorreu: Date | string;
            }[] }),
      ]);

      const filasContadas = new Set<string>();
      const musicasPorUser = new Map<number, Set<string>>();
      const parceirosPorUser = new Map<number, Set<number>>();
      const batalhas = new Map<string, {
        titulo: string;
        r1?: { user_id: number; nota: number; linhas: unknown; iso: string };
        r2?: { user_id: number; nota: number; linhas: unknown; iso: string };
      }>();

      for (const r of filaRes.rows) {
        const iso = paraISO(r.ocorreu);
        if (!dentroDaJanela(iso)) continue;
        filasContadas.add(String(r.id));
        const musicaId = r.catalogo_id != null
          ? `catalogo:${r.catalogo_id}`
          : (r.lrclib_id != null ? `lrclib:${r.lrclib_id}` : `video:${r.video_id}`);
        const nota = Number(r.nota);
        const nivel = r.detalhes?.nivel ?? null;
        const combo = typeof r.detalhes?.maiorCombo === 'number' ? r.detalhes.maiorCombo : 0;
        const uid = Number(r.user_id);
        const dueto = r.dueto_user_id != null && Number(r.dueto_user_id) !== uid ? Number(r.dueto_user_id) : null;

        karaoke.push({
          id: r.id,
          user_id: uid,
          dueto_user_id: dueto,
          musica_id: musicaId,
          titulo: r.titulo,
          nota,
          nivel,
          ocorreu_em: iso,
        });

        const participantes = dueto ? [uid, dueto] : [uid];
        for (const pid of participantes) {
          const m = metricaDe(pid);
          if (!m) continue;
          marcarEdicao(pid, ano);
          m.karaoke_cantadas++;
          if (nota > m.karaoke_melhor_nota) m.karaoke_melhor_nota = nota;
          if (nota >= 90 && nivel !== 'facil') m.karaoke_nota_90++;
          if (nota === 100 && nivel !== 'facil') m.karaoke_nota_100 = true;
          if (nivel === 'dificil') m.karaoke_dificil_cantadas++;
          if (combo > m.karaoke_maior_combo) m.karaoke_maior_combo = combo;

          const sm = musicasPorUser.get(pid) ?? new Set<string>();
          sm.add(musicaId);
          musicasPorUser.set(pid, sm);

          if (dueto) {
            m.karaoke_duetos++;
            const outro = pid === uid ? dueto : uid;
            const sp = parceirosPorUser.get(pid) ?? new Set<number>();
            sp.add(outro);
            parceirosPorUser.set(pid, sp);
          }
        }

        if (r.batalha_id && (Number(r.batalha_rodada) === 1 || Number(r.batalha_rodada) === 2)) {
          const b = batalhas.get(r.batalha_id) ?? { titulo: r.titulo };
          const item = { user_id: uid, nota, linhas: r.notas_linhas, iso };
          if (Number(r.batalha_rodada) === 1) b.r1 = item;
          else b.r2 = item;
          batalhas.set(r.batalha_id, b);
        }
      }

      for (const [uid, sp] of parceirosPorUser) {
        const m = metricaDe(uid);
        if (m) m.karaoke_parceiros_dueto = sp.size;
      }

      for (const [batalhaId, b] of batalhas) {
        if (!b.r1 || !b.r2 || b.r1.user_id === b.r2.user_id) continue;
        let venc = vencedorBatalhaLinhas(b.r1.linhas, b.r2.linhas);
        if (venc === null && b.r1.linhas == null && b.r2.linhas == null && b.r1.nota !== b.r2.nota) {
          venc = b.r1.nota > b.r2.nota ? 1 : 2;
        }
        if (venc === null) continue;
        const ganhador = venc === 1 ? b.r1.user_id : b.r2.user_id;
        const isoFim = Date.parse(b.r1.iso) >= Date.parse(b.r2.iso) ? b.r1.iso : b.r2.iso;
        const m = metricaDe(ganhador);
        if (m) m.karaoke_batalhas_vencidas++;
        fatos.push({
          user_id: ganhador,
          origem: 'karaoke',
          regra: 'karaoke_batalha',
          ref: `batalha:${batalhaId}`,
          pontos: 30,
          descricao: `Venceu batalha de karaokê: ${resumir(b.titulo, 36)}`,
          ocorreu_em: isoFim,
        });
      }

      for (const r of provaRes.rows) {
        if (r.fila_id != null && filasContadas.has(String(r.fila_id))) continue;
        const iso = paraISO(r.ocorreu);
        if (!dentroDaJanela(iso)) continue;
        const uid = Number(r.user_id);
        const nota = Number(r.nota);
        const musicaId = `catalogo:${r.catalogo_id}`;
        karaoke.push({
          id: `prova:${r.id}`,
          user_id: uid,
          musica_id: musicaId,
          titulo: r.titulo,
          nota,
          nivel: 'dificil',
          ocorreu_em: iso,
        });
        const m = metricaDe(uid);
        if (m) {
          m.karaoke_cantadas++;
          m.karaoke_dificil_cantadas++;
          if (nota > m.karaoke_melhor_nota) m.karaoke_melhor_nota = nota;
          if (nota >= 90) m.karaoke_nota_90++;
          if (nota === 100) m.karaoke_nota_100 = true;
          const sm = musicasPorUser.get(uid) ?? new Set<string>();
          sm.add(musicaId);
          musicasPorUser.set(uid, sm);
        }
      }

      for (const [uid, sm] of musicasPorUser) {
        const m = metricaDe(uid);
        if (m) m.karaoke_musicas_distintas = sm.size;
      }
    })(),

    // 11) Missões relâmpago aprovadas
    (async () => {
      if (!tem(e, 'gami_missoes', 'id', 'ano', 'titulo', 'pontos', 'inicia_em')
          || !tem(e, 'gami_missoes_respostas', 'id', 'missao_id', 'user_id', 'status', 'created_at')) {
        return;
      }
      const { rows } = await q<{
        missao_id: string | number;
        user_id: number;
        titulo: string;
        pontos: number;
        inicia_em: Date | string;
        ocorreu: Date | string;
      }>(
        `SELECT m.id AS missao_id, r.user_id, m.titulo, m.pontos,
                ${tsSQL(e, 'gami_missoes', 'm', 'inicia_em')} AS inicia_em,
                ${tsSQL(e, 'gami_missoes_respostas', 'r', 'created_at')} AS ocorreu
           FROM gami_missoes_respostas r
           JOIN gami_missoes m ON m.id = r.missao_id
          WHERE m.ano = $1 AND r.status = 'aprovada'
            AND ${tsSQL(e, 'gami_missoes_respostas', 'r', 'created_at')} <= $2::timestamptz
          ORDER BY r.id`,
        [ano, encerraIso],
      );
      for (const r of rows) {
        const uid = Number(r.user_id);
        const iso = paraISO(r.ocorreu);
        if (!metricaDe(uid) || !dentroDaJanela(iso)) continue;
        const ref = `missao:${r.missao_id}`;
        const iniIso = paraISO(r.inicia_em);
        const rapida15min = Boolean(
          iniIso && Date.parse(iso) - Date.parse(iniIso) >= 0 && Date.parse(iso) - Date.parse(iniIso) <= 15 * 60 * 1000,
        );
        metaMissaoPorRef.set(`${uid}|${ref}`, { uid, rapida15min });
        fatos.push({
          user_id: uid,
          origem: 'missao',
          regra: 'missao',
          ref,
          pontos: Number(r.pontos),
          descricao: `Missão cumprida: ${resumir(r.titulo, 40)}`,
          ocorreu_em: iso,
        });
      }
    })(),

    // 12) Vaquinha e histórico de edições (somente selos comemorativos com 0 pontos e contagem de veterano)
    (async () => {
      const [payRes, partRes, drawsRes, histRes] = await Promise.all([
        tem(e, 'payments', 'id', 'user_id', 'participant_id', 'status', 'paid_at', 'created_at')
          && tem(e, 'participants', 'id', 'user_id')
          ? q<{ user_id: number | null; ano: number; pago_em: Date | string }>(
              `SELECT COALESCE(pay.user_id, p.user_id) AS user_id,
                      ${anoSQL(e, 'payments', 'pay')} AS ano,
                      COALESCE(${tsSQL(e, 'payments', 'pay', 'paid_at')}, ${tsSQL(e, 'payments', 'pay', 'created_at')}) AS pago_em
                 FROM payments pay
                 JOIN participants p ON p.id = pay.participant_id
                WHERE pay.status = 'PAID'
                ORDER BY 3, pay.id`,
            )
          : Promise.resolve({ rows: [] as { user_id: number | null; ano: number; pago_em: Date | string }[] }),
        tem(e, 'participants', 'user_id', 'paid', 'paid_date')
          ? q<{ user_id: number; ano: number; pago_em: Date | string }>(
              `SELECT p.user_id, ${anoSQL(e, 'participants', 'p', 'paid_date')} AS ano,
                      ${tsSQL(e, 'participants', 'p', 'paid_date')} AS pago_em
                 FROM participants p
                WHERE p.paid = true AND p.paid_date IS NOT NULL AND p.user_id IS NOT NULL`,
            )
          : Promise.resolve({ rows: [] as { user_id: number; ano: number; pago_em: Date | string }[] }),
        tem(e, 'secret_santa_draws', 'giver_id', 'config_id')
          && tem(e, 'secret_santa_config', 'id', 'created_at')
          && tem(e, 'participants', 'id', 'user_id')
          ? q<{ user_id: number | null; ano: number }>(
              `SELECT p.user_id, ${anoSQL(e, 'secret_santa_config', 'c')} AS ano
                 FROM secret_santa_draws d
                 JOIN secret_santa_config c ON c.id = d.config_id
                 JOIN participants p ON p.id = d.giver_id
                WHERE p.user_id IS NOT NULL`,
            )
          : Promise.resolve({ rows: [] as { user_id: number | null; ano: number }[] }),
        tem(e, 'secret_santa_history', 'giver_participant_id', 'receiver_participant_id', 'ano')
          && tem(e, 'participants', 'id', 'user_id')
          ? q<{ user_id: number | null; ano: number }>(
              `SELECT p.user_id, h.ano
                 FROM secret_santa_history h
                 JOIN participants p ON p.id = h.giver_participant_id OR p.id = h.receiver_participant_id
                WHERE p.user_id IS NOT NULL`,
            )
          : Promise.resolve({ rows: [] as { user_id: number | null; ano: number }[] }),
      ]);

      let achouPrimeiro = false;
      for (const r of payRes.rows) {
        if (r.user_id == null) continue;
        const uid = Number(r.user_id);
        const ed = Number(r.ano);
        const iso = paraISO(r.pago_em);
        if (ed === ano && (!iso || Date.parse(iso) > encerraMs)) continue;
        marcarEdicao(uid, ed);
        if (idsValidos.has(uid) && ed >= 2020 && ed <= ano) {
          const sv = vaquinhaEdicoesPorUser.get(uid) ?? new Set<number>();
          sv.add(ed);
          vaquinhaEdicoesPorUser.set(uid, sv);
        }
        if (ed !== ano) continue;
        const m = metricaDe(uid);
        if (!m || !iso) continue;
        if (!achouPrimeiro) {
          m.vaquinha_primeiro = true;
          achouPrimeiro = true;
        }
        m.vaquinha_contribuiu = true;
        if (diaSPDeISO(iso).startsWith(`${ano}-11-`)) m.vaquinha_novembro = true;
      }

      for (const r of partRes.rows) {
        const uid = Number(r.user_id);
        const ed = Number(r.ano);
        const iso = paraISO(r.pago_em);
        if (ed === ano && (!iso || Date.parse(iso) > encerraMs)) continue;
        marcarEdicao(uid, ed);
        if (idsValidos.has(uid) && ed >= 2020 && ed <= ano) {
          const sv = vaquinhaEdicoesPorUser.get(uid) ?? new Set<number>();
          sv.add(ed);
          vaquinhaEdicoesPorUser.set(uid, sv);
        }
        if (ed === ano) {
          const m = metricaDe(uid);
          if (m) m.vaquinha_contribuiu = true;
        }
      }

      for (const r of drawsRes.rows) {
        if (r.user_id != null) marcarEdicao(Number(r.user_id), Number(r.ano));
      }
      for (const r of histRes.rows) {
        if (r.user_id != null) marcarEdicao(Number(r.user_id), Number(r.ano));
      }
    })(),
  ]);

  // Processa reações brutas depois que postsValidosEdicao está completo:
  // deduplica por (post_id, user_id) e só conta em posts válidos da edição.
  const reacoesRecebidasUnicas = new Set<string>();
  for (const r of reacoesBrutas) {
    if (Number(r.post_ano) !== ano) continue;
    const postId = Number(r.post_id);
    if (!postsValidosEdicao.has(postId)) continue;
    const iso = paraISO(r.ocorreu);
    if (!dentroDaJanela(iso)) continue;
    const uid = Number(r.user_id);
    const dono = Number(r.post_owner);
    if (uid === dono) continue;

    const chavePostUser = `${postId}|${uid}`;
    if (!reacoesRecebidasUnicas.has(chavePostUser)) {
      reacoesRecebidasUnicas.add(chavePostUser);
      const mDono = metricaDe(dono);
      if (mDono) mDono.reacoes_recebidas++;
    }

    if (metricaDe(uid)) {
      const ref = `reacao:post:${postId}`;
      const chaveMeta = `${uid}|${ref}`;
      if (!metaReacaoPorRef.has(chaveMeta)) {
        metaReacaoPorRef.set(chaveMeta, { uid, dono, postId });
      }
      fatos.push({
        user_id: uid,
        origem: 'uso',
        regra: 'reacao',
        ref,
        pontos: 1,
        descricao: `Curtida/reação no mural (${curtoDataSP(iso)})`,
        ocorreu_em: iso,
      });
    }
  }

  for (const [uid, s] of edicoesPorUser) {
    const m = metricaDe(uid);
    if (m) m.edicoes_participadas = s.size;
  }
  for (const [uid, s] of vaquinhaEdicoesPorUser) {
    const m = metricaDe(uid);
    if (m) m.vaquinha_edicoes = s.size;
  }

  // Aplica tetos diários/totais, corte temporal e anulações sobre os fatos e usa o que sobrou nas métricas de conquistas!
  const janela = {
    ano,
    inicio_em: inicioIso,
    encerra_em: encerraIso,
    anulados,
  };
  const lancamentosFatos = aplicarTetosFatos(fatos, janela);
  const lancamentosKaraoke = calcularLancamentosKaraoke(karaoke, janela);

  const albumPorUserDia = new Map<string, number>();
  const autoresComentadosPorUser = new Map<number, Set<number>>();
  const autoresReagidosPorUser = new Map<number, Set<number>>();
  const destCapsulaPorUser = new Map<number, Set<number>>();

  for (const l of lancamentosFatos) {
    const m = metricaDe(l.user_id);
    if (!m) continue;
    const chave = `${l.user_id}|${l.ref}`;

    switch (l.regra) {
      case 'post': {
        m.posts++;
        const meta = metaPostPorRef.get(chave);
        if (meta?.temFoto) {
          m.posts_com_foto++;
          m.fotos_mural++;
          m.fotos_total++;
        }
        if (meta?.postLongo) m.post_longo = true;
        if (meta?.madrugada) m.postou_madrugada = true;
        if (meta?.cedo) m.abriu_cedo = true;
        break;
      }
      case 'foto_album': {
        m.fotos_album++;
        m.fotos_total++;
        const chDia = `${l.user_id}|${diaSPDeISO(l.ocorreu_em)}`;
        const qtdDia = (albumPorUserDia.get(chDia) ?? 0) + 1;
        albumPorUserDia.set(chDia, qtdDia);
        if (qtdDia >= 5) m.album_5_mesmo_dia = true;
        break;
      }
      case 'comentario': {
        m.comentarios++;
        const meta = metaComentarioPorRef.get(chave);
        if (meta?.madrugada) m.postou_madrugada = true;
        if (meta && meta.dono !== l.user_id) {
          const s = autoresComentadosPorUser.get(l.user_id) ?? new Set<number>();
          s.add(meta.dono);
          autoresComentadosPorUser.set(l.user_id, s);
          const mDono = metricaDe(meta.dono);
          if (mDono) mDono.comentarios_recebidos++;
        }
        break;
      }
      case 'reacao': {
        m.reacoes_dadas++;
        const meta = metaReacaoPorRef.get(chave);
        if (meta && meta.dono !== l.user_id) {
          const s = autoresReagidosPorUser.get(l.user_id) ?? new Set<number>();
          s.add(meta.dono);
          autoresReagidosPorUser.set(l.user_id, s);
        }
        break;
      }
      case 'advento':
        m.advento_respostas++;
        break;
      case 'advento_voto':
        m.advento_votos++;
        break;
      case 'desejo':
        m.desejos++;
        break;
      case 'receita':
        m.receitas++;
        break;
      case 'historia':
        m.historias++;
        break;
      case 'capsula': {
        m.capsulas++;
        const meta = metaCapsulaPorRef.get(chave);
        if (meta?.destinatario != null) {
          const s = destCapsulaPorUser.get(l.user_id) ?? new Set<number>();
          s.add(meta.destinatario);
          destCapsulaPorUser.set(l.user_id, s);
        }
        break;
      }
      case 'homenagem':
        m.homenagens++;
        break;
      case 'arvore':
        m.pessoas_arvore++;
        break;
      case 'missao': {
        m.missoes_cumpridas++;
        const meta = metaMissaoPorRef.get(chave);
        if (meta?.rapida15min) m.missao_em_15min = true;
        break;
      }
      default:
        break;
    }
  }

  for (const [uid, s] of autoresComentadosPorUser) {
    const m = metricaDe(uid);
    if (m) m.autores_comentados = s.size;
  }
  for (const [uid, s] of autoresReagidosPorUser) {
    const m = metricaDe(uid);
    if (m) m.autores_reagidos = s.size;
  }
  for (const [uid, s] of destCapsulaPorUser) {
    const m = metricaDe(uid);
    if (m) m.capsulas_destinatarios = s.size;
  }

  return {
    usuarios,
    fatos,
    karaoke,
    lancamentosFatos,
    lancamentosKaraoke,
    metricasPorUser,
  };
}

export interface ResultadoRecalculo {
  rodou: boolean;
  lancamentos: number;
  novas_conquistas: number;
}

/**
 * Recalcula de forma idempotente todo o extrato do ano:
 * - Faz toda a coleta de leitura em paralelo no pool FORA da transação;
 * - Dentro da transação segura a trava advisory e faz apenas as gravações em lote (UNNEST);
 * - Revoga conquistas de conteúdo apagado enquanto revelado_em for null;
 * - Não insere novas conquistas depois de encerra_em;
 * - Agrupa notificações de conquista por pessoa respeitando a janela 8h-22h SP.
 */
export async function recalcular(ano = edicaoAtual()): Promise<ResultadoRecalculo> {
  if (recalculosEmAndamento.has(ano)) {
    return { rodou: false, lancamentos: 0, novas_conquistas: 0 };
  }
  recalculosEmAndamento.add(ano);

  try {
    const e = await inspecionarEsquema();
    if (
      !tem(e, 'gami_lancamentos', 'ano', 'user_id', 'origem', 'regra', 'ref', 'pontos', 'descricao', 'ocorreu_em')
      || !tem(e, 'gami_conquistas', 'ano', 'user_id', 'conquista_id', 'ganha_em', 'notificada_em')
    ) {
      return { rodou: false, lancamentos: 0, novas_conquistas: 0 };
    }

    // Coleta de leitura em paralelo FORA da transação.
    const [config, { anulados, ajustesRows }] = await Promise.all([
      lerConfigInterna(ano, query, e),
      carregarAnuladosEdicao(query, e, ano),
    ]);
    const coleta = await coletarDadosEdicao(query, e, ano, config.encerra_em, anulados);

    const novosUsers: number[] = [];
    const novosIds: string[] = [];
    const chavesAlcancadas: string[] = [];

    for (const [uid, m] of coleta.metricasPorUser) {
      for (const c of avaliarConquistasAlcancadas(m)) {
        novosUsers.push(uid);
        novosIds.push(c.id);
        chavesAlcancadas.push(`${uid}|${c.id}`);
      }
    }

    const pendentesPorUser = new Map<number, DefinicaoConquista[]>();
    let totalLancamentos = 0;

    // Transação curta: apenas trava advisory + gravações em lote.
    const rodou = await transaction(async (q) => {
      const lock = await q<{ ok: boolean }>(
        `SELECT pg_try_advisory_xact_lock($1::int, $2::int) AS ok`,
        [LOCK_RECALCULAR, ano],
      );
      if (!lock.rows[0]?.ok) return false;

      // Enquanto não houver revelado_em, revoga conquistas de conteúdo que deixaram de ser alcançadas.
      if (!config.revelado_em) {
        await q(
          `DELETE FROM gami_conquistas
            WHERE ano = $1
              AND NOT (conquista_id = ANY($2::text[]))
              AND NOT ((user_id::text || '|' || conquista_id) = ANY($3::text[]))`,
          [ano, [...IDS_CONQUISTAS_IRREVOGAVEIS], chavesAlcancadas],
        );
      }

      // Não insere conquistas novas depois de encerra_em.
      const antesDeEncerrar = Date.now() <= Date.parse(config.encerra_em);
      if (antesDeEncerrar && novosUsers.length > 0) {
        await q(
          `INSERT INTO gami_conquistas (ano, user_id, conquista_id, ganha_em)
           SELECT $1, u_id, c_id, LEAST(NOW(), $4::timestamptz)
             FROM UNNEST($2::int[], $3::text[]) AS t(u_id, c_id)
           ON CONFLICT (ano, user_id, conquista_id) DO NOTHING`,
          [ano, novosUsers, novosIds, config.encerra_em],
        );
      }

      // Lê todas as conquistas ganhas do ano.
      const { rows: ganhasRows } = await q<{
        user_id: number;
        conquista_id: string;
        ganha_em: Date | string;
        notificada_em: Date | string | null;
      }>(
        `SELECT user_id, conquista_id, ganha_em, notificada_em
           FROM gami_conquistas WHERE ano = $1 ORDER BY ganha_em, conquista_id`,
        [ano],
      );

      const lancConquistas: LancamentoGerado[] = [];
      for (const g of ganhasRows) {
        const def = MAPA_CONQUISTAS.get(g.conquista_id);
        if (!def) continue;
        const uid = Number(g.user_id);
        if (!g.notificada_em) {
          const lista = pendentesPorUser.get(uid) ?? [];
          lista.push(def);
          pendentesPorUser.set(uid, lista);
        }
        const pts = pontosDaConquista(def);
        if (pts <= 0) continue;
        const regra = `conquista:${def.id}`;
        const ref = def.id;
        const setAnul = anulados.get(uid);
        if (setAnul?.has(`${regra}|${ref}`) || setAnul?.has(regra)) continue;
        lancConquistas.push({
          user_id: uid,
          origem: 'conquista',
          regra,
          ref,
          pontos: pts,
          descricao: `Conquista desbloqueada: ${def.nome}`,
          ocorreu_em: paraISO(g.ganha_em) ?? config.encerra_em,
        });
      }

      // Ajustes manuais e anulações ('Anulado pela organização: motivo') em lote com UNNEST.
      const lancAjustes: LancamentoGerado[] = [];
      for (const aj of ajustesRows) {
        const uid = Number(aj.user_id);
        const ehAnulacao = Boolean(aj.anula_ref && aj.anula_ref.trim());
        const pts = ehAnulacao ? 0 : Number(aj.pontos);
        if (!ehAnulacao && pts === 0) continue;
        const descr = ehAnulacao
          ? `Anulado pela organização: ${aj.motivo}`
          : `Ajuste da organização: ${aj.motivo}`;
        lancAjustes.push({
          user_id: uid,
          origem: 'ajuste',
          regra: 'ajuste',
          ref: `ajuste:${aj.id}`,
          pontos: pts,
          descricao: descr,
          ocorreu_em: paraISO(aj.created_at) ?? new Date().toISOString(),
        });
      }

      const todosGerados = [
        ...coleta.lancamentosFatos,
        ...coleta.lancamentosKaraoke,
        ...lancConquistas,
        ...lancAjustes,
      ];
      totalLancamentos = todosGerados.length;

      await q(`DELETE FROM gami_lancamentos WHERE ano = $1`, [ano]);

      if (todosGerados.length > 0) {
        await q(
          `INSERT INTO gami_lancamentos (ano, user_id, origem, regra, ref, pontos, descricao, ocorreu_em)
           SELECT $1, u_id, orig, reg, rf, pts, descr, oc
             FROM UNNEST(
               $2::int[],
               $3::text[],
               $4::text[],
               $5::text[],
               $6::int[],
               $7::text[],
               $8::timestamptz[]
             ) AS t(u_id, orig, reg, rf, pts, descr, oc)
           ON CONFLICT (ano, user_id, regra, ref) DO UPDATE SET
             pontos = EXCLUDED.pontos,
             descricao = EXCLUDED.descricao,
             ocorreu_em = EXCLUDED.ocorreu_em`,
          [
            ano,
            todosGerados.map((l) => l.user_id),
            todosGerados.map((l) => l.origem),
            todosGerados.map((l) => l.regra),
            todosGerados.map((l) => l.ref),
            todosGerados.map((l) => l.pontos),
            todosGerados.map((l) => l.descricao),
            todosGerados.map((l) => l.ocorreu_em),
          ],
        );
      }

      if (tem(e, 'gami_config', 'ano', 'recalculado_em')) {
        const padrao = configPadrao(ano, config.excluidos);
        if (tem(e, 'gami_config', 'excluidos')) {
          await q(
            `INSERT INTO gami_config (ano, encerra_em, ranking_oculto_em, missoes_surpresa, excluidos, recalculado_em, updated_at)
             VALUES ($1, $2, $3, $4, $5::int[], NOW(), NOW())
             ON CONFLICT (ano) DO UPDATE SET recalculado_em = NOW()`,
            [ano, padrao.encerra_em, padrao.ranking_oculto_em, padrao.missoes_surpresa, config.excluidos],
          );
        } else {
          await q(
            `INSERT INTO gami_config (ano, encerra_em, ranking_oculto_em, missoes_surpresa, recalculado_em, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())
             ON CONFLICT (ano) DO UPDATE SET recalculado_em = NOW()`,
            [ano, padrao.encerra_em, padrao.ranking_oculto_em, padrao.missoes_surpresa],
          );
        }
      }
      ultimoRecalculoMemoria.set(ano, Date.now());
      return true;
    });

    if (!rodou) {
      return { rodou: false, lancamentos: 0, novas_conquistas: 0 };
    }

    // Fora da transação: envia push + sininho agrupados por pessoa, respeitando a janela 8h-22h SP.
    let notificadas = 0;
    if (pendentesPorUser.size > 0 && horarioPermitidoPushSP(new Date())) {
      const temSininho = tem(e, 'family_notifications', 'user_id', 'actor_id', 'type');
      const temReaction = tem(e, 'family_notifications', 'reaction_type');

      for (const [userId, conquistas] of pendentesPorUser) {
        try {
          const ids = conquistas.map((c) => c.id);
          const { rows: marcadas } = await query<{ conquista_id: string }>(
            `UPDATE gami_conquistas
                SET notificada_em = NOW()
              WHERE ano = $1 AND user_id = $2 AND conquista_id = ANY($3::text[]) AND notificada_em IS NULL
              RETURNING conquista_id`,
            [ano, userId, ids],
          );
          if (marcadas.length === 0) continue;

          const setMarcadas = new Set(marcadas.map((m) => m.conquista_id));
          const efetivas = conquistas.filter((c) => setMarcadas.has(c.id));
          if (efetivas.length === 0) continue;
          notificadas += efetivas.length;

          const ehAgrupada = efetivas.length > 1;
          const textoAgrupado = `Você desbloqueou ${efetivas.length} conquistas!`;
          const unica = efetivas[0];
          const textoSininho = ehAgrupada ? textoAgrupado : unica.nome;

          if (temSininho) {
            if (temReaction) {
              await query(
                `INSERT INTO family_notifications (user_id, actor_id, type, reaction_type)
                 VALUES ($1, $1, 'conquista', $2)`,
                [userId, textoSininho],
              );
            } else {
              await query(
                `INSERT INTO family_notifications (user_id, actor_id, type)
                 VALUES ($1, $1, 'conquista')`,
                [userId],
              );
            }
          }

          if (ehAgrupada) {
            const ptsTotal = efetivas.reduce((acc, c) => acc + pontosDaConquista(c), 0);
            const sufixoPts = ptsTotal > 0 ? ` (+${ptsTotal} pts)` : '';
            await enviarPush([userId], {
              titulo: textoAgrupado,
              corpo: `Confira suas novas medalhas no painel de conquistas${sufixoPts}.`,
              rota: '/conquistas',
            });
          } else {
            const pts = pontosDaConquista(unica);
            const sufixoPts = pts > 0 ? ` (+${pts} pts)` : '';
            await enviarPush([userId], {
              titulo: `Conquista desbloqueada: ${unica.nome}`,
              corpo: `${unica.descricao}${sufixoPts}`,
              rota: '/conquistas',
            });
          }
        } catch (err) {
          console.error('[gamificacao:notificar]', err instanceof Error ? err.message : 'falha');
        }
      }
    }

    return { rodou: true, lancamentos: totalLancamentos, novas_conquistas: notificadas };
  } finally {
    recalculosEmAndamento.delete(ano);
  }
}

/** Garante que o extrato foi recalculado nos últimos 60 segundos antes de abrir páginas de pontos. */
export async function garantirRecalculoRecente(ano = edicaoAtual()): Promise<void> {
  const cfg = await lerConfigInterna(ano);
  const ultimoMs = cfg.recalculado_em ? Date.parse(cfg.recalculado_em) : NaN;
  if (Number.isFinite(ultimoMs) && Date.now() - ultimoMs <= RECALCULO_FRESCO_MS) return;
  await recalcular(ano);
}

/** Retorna IDs dos participantes da competição (exclui gami_config.excluidos e 'Revisão das Lojas'). */
export async function idsParticipantesCompeticao(
  ano = edicaoAtual(),
  e?: EsquemaBanco,
  excluidosConhecidos?: readonly number[],
): Promise<number[]> {
  const esquema = e ?? await inspecionarEsquema();
  const excluidos = excluidosConhecidos ?? (await lerConfigInterna(ano, query, esquema)).excluidos;
  const setExcluidos = new Set(excluidos.map(Number));
  const { rows } = await query<{ id: number; name: string }>(`SELECT id, name FROM family_users ORDER BY id`);
  return rows
    .filter((r) => !setExcluidos.has(Number(r.id)) && r.name !== CONTA_REVISAO_LOJAS)
    .map((r) => Number(r.id));
}

/**
 * Ciclo periódico de 5 em 5 minutos:
 * 1) Recupera tentativas interrompidas da Prova do Karaokê (se a tabela existir);
 * 2) Recalcula extrato e conquistas;
 * 3) Sorteia missão surpresa se ativo (1/12 até encerra_em, máx. 1 por dia, início 10h-20h SP);
 * 4) Envia pushes de missões (começou / falta 1 hora) e de ocultação do ranking para quem participa da competição, respeitando janela 8h-22h SP.
 */
export async function executarCicloGamificacao(agora: Date = new Date()): Promise<string> {
  const ano = edicaoAtual(agora);
  const e = await inspecionarEsquema();
  if (!tem(e, 'gami_lancamentos', 'ano')) {
    return 'Gamificação: tabelas ainda não criadas.';
  }

  // Recupera tentativas interrompidas da Prova do Karaokê antes do recálculo.
  try {
    const reg = await query<{ reg: string | null }>(
      `SELECT to_regclass('public.karaoke_prova_tentativas')::text AS reg`,
    );
    if (reg.rows[0]?.reg) {
      await transaction(async (q) => {
        await recuperarInterrompidas(q, ano);
      });
    }
  } catch (err) {
    console.error('[gamificacao:prova]', err instanceof Error ? err.message : 'falha');
  }

  const rec = await recalcular(ano);
  let missaoCriada = false;
  let pushesEnviados = 0;

  if (tem(e, 'gami_missoes', 'id', 'ano', 'modelo', 'titulo', 'descricao', 'tipo', 'pontos', 'inicia_em', 'termina_em')) {
    missaoCriada = await transaction(async (q) => {
      const lk = await q<{ ok: boolean }>(
        `SELECT pg_try_advisory_xact_lock($1::int, $2::int) AS ok`,
        [LOCK_CRON_GAMI, ano],
      );
      if (!lk.rows[0]?.ok) return false;

      const cfg = await lerConfigInterna(ano, q, e);
      if (!cfg.missoes_surpresa) return false;

      const { rows: existentes } = await q<{ modelo: string | null; dia: string }>(
        `SELECT modelo, (inicia_em AT TIME ZONE 'America/Sao_Paulo')::date::text AS dia
           FROM gami_missoes WHERE ano = $1`,
        [ano],
      );
      const modelosUsados = new Set<string>();
      const diasComMissao = new Set<string>();
      for (const r of existentes) {
        if (r.modelo) modelosUsados.add(r.modelo);
        if (r.dia) diasComMissao.add(r.dia);
      }

      const sorteada = planejarMissaoSurpresa({
        ano,
        encerra_em: cfg.encerra_em,
        modelosUsados,
        diasComMissao,
        agora,
      });
      if (!sorteada) return false;

      await q(
        `INSERT INTO gami_missoes (ano, modelo, titulo, descricao, tipo, pontos, inicia_em, termina_em)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          ano,
          sorteada.modelo.id,
          sorteada.modelo.titulo,
          sorteada.modelo.descricao,
          sorteada.modelo.tipo,
          sorteada.modelo.pontos,
          sorteada.inicia_em,
          sorteada.termina_em,
        ],
      );
      return true;
    });
  }

  // Pushes só saem entre 8h e 22h SP; entre 22h e 8h ficam pendentes até as 8h.
  if (horarioPermitidoPushSP(agora)) {
    const cfg = await lerConfigInterna(ano, query, e);
    const destinos = await idsParticipantesCompeticao(ano, e, cfg.excluidos);
    if (destinos.length > 0 && tem(e, 'gami_missoes', 'aviso_inicio_em', 'aviso_fim_em')) {
      if (agora.getTime() < Date.parse(cfg.encerra_em)) {
        // 1) Push de missão que já começou e ainda está ativa
        const iniciadas = await transaction(async (q) => {
          const { rows } = await q<{ id: number; titulo: string; pontos: number }>(
            `WITH fila AS (
               SELECT id FROM gami_missoes
                WHERE ano = $1
                  AND aviso_inicio_em IS NULL
                  AND inicia_em <= $2::timestamptz
                  AND termina_em > $2::timestamptz
                ORDER BY inicia_em, id
                FOR UPDATE SKIP LOCKED
             )
             UPDATE gami_missoes AS m
                SET aviso_inicio_em = NOW()
               FROM fila
              WHERE m.id = fila.id
             RETURNING m.id, m.titulo, m.pontos`,
            [ano, agora.toISOString()],
          );
          return rows;
        });

        for (const m of iniciadas) {
          await enviarPush(destinos, {
            titulo: `Missão relâmpago (+${m.pontos} pts)!`,
            corpo: m.titulo,
            rota: '/missoes',
          });
          pushesEnviados++;
        }

        // 2) Push de "falta 1 hora" para missões prestes a encerrar
        const acabando = await transaction(async (q) => {
          const { rows } = await q<{ id: number; titulo: string; pontos: number }>(
            `WITH fila AS (
               SELECT id FROM gami_missoes
                WHERE ano = $1
                  AND aviso_inicio_em IS NOT NULL
                  AND aviso_fim_em IS NULL
                  AND inicia_em <= $2::timestamptz
                  AND termina_em > $2::timestamptz
                  AND termina_em <= ($2::timestamptz + INTERVAL '1 hour')
                ORDER BY termina_em, id
                FOR UPDATE SKIP LOCKED
             )
             UPDATE gami_missoes AS m
                SET aviso_fim_em = NOW()
               FROM fila
              WHERE m.id = fila.id
             RETURNING m.id, m.titulo, m.pontos`,
            [ano, agora.toISOString()],
          );
          return rows;
        });

        for (const m of acabando) {
          await enviarPush(destinos, {
            titulo: 'Falta menos de 1 hora!',
            corpo: `Última chamada para a missão "${m.titulo}" (+${m.pontos} pts).`,
            rota: '/missoes',
          });
          pushesEnviados++;
        }
      }

      // 3) Avisos do ranking (24h antes de ocultar e quando oculta)
      if (tem(e, 'gami_config', 'aviso_24h_em', 'aviso_oculto_em')) {
        const ocultoMs = Date.parse(cfg.ranking_oculto_em);
        const encerraMs = Date.parse(cfg.encerra_em);
        const agoraMs = agora.getTime();

        if (!cfg.revelado_em && agoraMs >= ocultoMs - 24 * 3600 * 1000 && agoraMs < ocultoMs) {
          const { rowCount } = await query(
            `UPDATE gami_config SET aviso_24h_em = NOW()
              WHERE ano = $1 AND aviso_24h_em IS NULL`,
            [ano],
          );
          if (rowCount) {
            await enviarPush(destinos, {
              titulo: 'O ranking some em 24 horas!',
              corpo: 'Confira sua posição antes que o placar fique secreto para a noite de Natal.',
              rota: '/pontos',
            });
            pushesEnviados++;
          }
        }

        if (!cfg.revelado_em && agoraMs >= ocultoMs && agoraMs < encerraMs) {
          const { rowCount } = await query(
            `UPDATE gami_config SET aviso_oculto_em = NOW()
              WHERE ano = $1 AND aviso_oculto_em IS NULL`,
            [ano],
          );
          if (rowCount) {
            await enviarPush(destinos, {
              titulo: 'O ranking sumiu!',
              corpo: 'Os pontos continuam valendo e o resultado sai no telão da festa!',
              rota: '/pontos',
            });
            pushesEnviados++;
          }
        }
      }
    }
  }

  return `Gamificação: recalc=${rec.rodou ? 'sim' : 'ocupado'}, novas=${rec.novas_conquistas}, missao=${missaoCriada ? 'sorteada' : 'nao'}, pushes=${pushesEnviados}.`;
}
