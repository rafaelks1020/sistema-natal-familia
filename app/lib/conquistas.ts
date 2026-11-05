import 'server-only';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { HttpError } from '@/app/lib/api';
import { parsePostImages } from '@/app/api/posts/_utils';

export interface Selo { id: string; nome: string; descricao: string; conquistado: boolean }
export interface Destaque { id: number; nome: string; avatar_url: string | null; total: number }
export interface Conquistas {
  ano: number;
  user_id: number;
  selos: Selo[];
  ranking: { id: string; titulo: string; pessoas: Destaque[] }[];
}

type Pessoa = { id: number; name: string; avatar_url: string | null };
type Colunas = Map<string, Set<string>>;
const TABELAS = ['family_users', 'participants', 'family_posts', 'family_post_comments', 'family_post_reactions', 'family_attendance', 'payments', 'secret_santa_draws', 'secret_santa_config', 'advent_responses', 'advent_votes', 'secret_santa_history', 'user_blocks'];

// Identificadores SQL abaixo vêm exclusivamente desta lista fixa, nunca da requisição.
async function esquema(): Promise<Colunas> {
  const { rows } = await query<{ tabela: string; colunas: string[] }>(
    `SELECT t.nome AS tabela, ARRAY_AGG(a.attname::text) AS colunas
       FROM unnest($1::text[]) t(nome)
       JOIN pg_attribute a ON a.attrelid = to_regclass('public.' || t.nome)
        AND a.attnum > 0 AND NOT a.attisdropped GROUP BY t.nome`, [TABELAS],
  );
  return new Map(rows.map((r) => [r.tabela, new Set(r.colunas)]));
}
function tem(e: Colunas, tabela: string, ...colunas: string[]): boolean {
  return colunas.every((coluna) => e.get(tabela)?.has(coluna));
}
function anoSQL(e: Colunas, tabela: string, alias: string): string {
  return tem(e, tabela, 'ano') ? `${alias}.ano` : `EXTRACT(YEAR FROM ${alias}.created_at - INTERVAL '2 months')::int`;
}

export async function carregarConquistas(viewerId: number, userId = viewerId): Promise<Conquistas> {
  const ano = edicaoAtual();
  const e = await esquema();
  const bloqueio = (alias: string) => tem(e, 'user_blocks', 'blocker_id', 'blocked_id')
    ? `NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $1 AND b.blocked_id = ${alias}.user_id)` : '$1::int > 0';
  const { rows: pessoas } = await query<Pessoa>(`SELECT u.id, u.name, u.avatar_url FROM family_users u
    WHERE ${tem(e, 'user_blocks', 'blocker_id', 'blocked_id') ? 'NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $1 AND b.blocked_id = u.id)' : '$1::int > 0'}`, [viewerId]);
  if (!pessoas.some((p) => p.id === userId)) throw new HttpError(404, 'Pessoa não encontrada.');
  const fotos = new Map<number, number>();
  const comentarios = new Map<number, number>();
  const coracoes = new Map<number, number>();
  const presentes = new Set<number>();
  const contribuiu = new Set<number>();
  const advento = new Map<number, Set<number>>();
  const edicoes = new Map<number, Set<number>>();
  let primeiro: number | undefined;
  function participou(id: number, edicao: number) {
    if (!Number.isInteger(edicao) || edicao > ano) return;
    const anos = edicoes.get(id) ?? new Set<number>();
    anos.add(edicao); edicoes.set(id, anos);
  }
  // Leituras independentes; a ausência de uma tabela de outra parte desativa só aquele selo.
  await Promise.all([
    (async () => {
      if (!tem(e, 'family_posts', 'id', 'user_id', 'created_at', 'image_url', 'image_urls')) return;
      const { rows } = await query<{ user_id: number; ano: number; image_url: string | null; image_urls: string | null }>(
        `SELECT p.user_id, ${anoSQL(e, 'family_posts', 'p')} AS ano, p.image_url, p.image_urls
           FROM family_posts p WHERE ${bloqueio('p')}`, [viewerId]);
      for (const p of rows) {
        participou(p.user_id, p.ano);
        if (p.ano === ano) fotos.set(p.user_id, (fotos.get(p.user_id) ?? 0) + parsePostImages(p.image_urls, p.image_url).length);
      }
    })(),
    (async () => {
      if (!tem(e, 'family_post_comments', 'user_id', 'created_at')) return;
      const { rows } = await query<{ user_id: number; ano: number; total: number }>(
        `SELECT c.user_id, ${anoSQL(e, 'family_post_comments', 'c')} AS ano, count(*)::int AS total
         FROM family_post_comments c WHERE ${bloqueio('c')} GROUP BY c.user_id, 2`, [viewerId]);
      for (const c of rows) { participou(c.user_id, c.ano); if (c.ano === ano) comentarios.set(c.user_id, c.total); }
    })(),
    (async () => {
      if (!tem(e, 'family_post_reactions', 'post_id', 'user_id', 'created_at') || !tem(e, 'family_posts', 'id', 'user_id', 'created_at')) return;
      const { rows } = await query<{ user_id: number; total: number }>(
        `SELECT p.user_id, count(*)::int AS total FROM family_post_reactions r JOIN family_posts p ON p.id = r.post_id
          WHERE ${anoSQL(e, 'family_posts', 'p')} = $2 AND ${anoSQL(e, 'family_post_reactions', 'r')} = $2
            AND ${bloqueio('r')} AND ${bloqueio('p')} GROUP BY p.user_id`, [viewerId, ano]);
      for (const r of rows) coracoes.set(r.user_id, r.total);
    })(),
    (async () => {
      if (!tem(e, 'family_attendance', 'participant_id', 'user_id', 'status', 'created_at') || !tem(e, 'participants', 'id', 'user_id')) return;
      const { rows } = await query<{ user_id: number; ano: number }>(
        `SELECT COALESCE(a.user_id, p.user_id) AS user_id, ${tem(e, 'family_attendance', 'ano') ? 'COALESCE(a.ano, $1::int)' : '$1::int'} AS ano
          FROM family_attendance a JOIN participants p ON p.id = a.participant_id WHERE a.status = 'yes'`, [ano]);
      for (const a of rows) { participou(a.user_id, a.ano); if (a.ano === ano) presentes.add(a.user_id); }
    })(),
    (async () => {
      if (!tem(e, 'payments', 'id', 'user_id', 'participant_id', 'status', 'paid_at', 'created_at') || !tem(e, 'participants', 'id', 'user_id')) return;
      const { rows } = await query<{ user_id: number; ano: number }>(
        `SELECT COALESCE(pay.user_id, p.user_id) AS user_id, ${anoSQL(e, 'payments', 'pay')} AS ano
           FROM payments pay JOIN participants p ON p.id = pay.participant_id
          WHERE pay.status = 'PAID' ORDER BY COALESCE(pay.paid_at, pay.created_at), pay.id`);
      let achouPrimeiro = false;
      for (const p of rows) {
        participou(p.user_id, p.ano);
        if (p.ano !== ano) continue;
        if (!achouPrimeiro) { primeiro = p.user_id; achouPrimeiro = true; }
        contribuiu.add(p.user_id);
      }

    })(),
    (async () => {
      if (!tem(e, 'secret_santa_draws', 'giver_id', 'config_id') || !tem(e, 'secret_santa_config', 'id', 'created_at') || !tem(e, 'participants', 'id', 'user_id')) return;
      const { rows } = await query<{ user_id: number; ano: number }>(
        `SELECT p.user_id, ${anoSQL(e, 'secret_santa_config', 'c')} AS ano FROM secret_santa_draws d
          JOIN secret_santa_config c ON c.id = d.config_id JOIN participants p ON p.id = d.giver_id`);
      for (const p of rows) participou(p.user_id, p.ano);
    })(),
    (async () => {
      // A confirmação manual já existente também conta para Vaquinha, nunca para o primeiro Pix.
      if (tem(e, 'participants', 'user_id', 'paid', 'paid_date')) {
        const { rows: manuais } = await query<{ user_id: number; ano: number }>(
          `SELECT user_id, EXTRACT(YEAR FROM paid_date - INTERVAL '2 months')::int AS ano FROM participants WHERE paid AND paid_date IS NOT NULL`);
        for (const p of manuais) { participou(p.user_id, p.ano); if (p.ano === ano) contribuiu.add(p.user_id); }
      }
    })(),
    (async () => {
      if (!tem(e, 'secret_santa_history', 'giver_participant_id', 'receiver_participant_id', 'ano') || !tem(e, 'participants', 'id', 'user_id')) return;
      const { rows } = await query<{ user_id: number; ano: number }>(
        `SELECT p.user_id, h.ano FROM secret_santa_history h JOIN participants p
          ON p.id = h.giver_participant_id OR p.id = h.receiver_participant_id`);
      for (const p of rows) participou(p.user_id, p.ano);
    })(),
    ...['advent_responses', 'advent_votes'].map(async (tabela) => {
      if (!tem(e, tabela, 'user_id', 'ano', 'dia')) return;
      const { rows } = await query<{ user_id: number; dia: number }>(`SELECT a.user_id, a.dia FROM ${tabela} a WHERE a.ano = $2 AND ${bloqueio('a')}`, [viewerId, ano]);
      for (const r of rows) { const dias = advento.get(r.user_id) ?? new Set<number>(); dias.add(r.dia); advento.set(r.user_id, dias); }
    }),
  ]);
  const selos: Selo[] = [
    { id: 'presente', nome: 'Presente', descricao: 'Confirmou presença nesta edição.', conquistado: presentes.has(userId) },
    { id: 'fotografo', nome: 'Fotógrafo', descricao: 'Publicou 10 fotos no mural ou no álbum nesta edição.', conquistado: (fotos.get(userId) ?? 0) >= 10 },
    { id: 'comentarista', nome: 'Comentarista', descricao: 'Fez 20 comentários nesta edição.', conquistado: (comentarios.get(userId) ?? 0) >= 20 },
    { id: 'coracao', nome: 'Coração', descricao: 'Recebeu 50 curtidas nas publicações desta edição.', conquistado: (coracoes.get(userId) ?? 0) >= 50 },
    { id: 'vaquinha', nome: 'Vaquinha', descricao: 'Contribuiu com a vaquinha desta edição.', conquistado: contribuiu.has(userId) },
    { id: 'primeiro', nome: 'Primeiro da vaquinha', descricao: 'Fez o primeiro pagamento confirmado desta edição.', conquistado: primeiro === userId },
    { id: 'veterano', nome: 'Veterano', descricao: 'Participou de pelo menos duas edições.', conquistado: (edicoes.get(userId)?.size ?? 0) >= 2 },
    { id: 'advento', nome: 'Advento', descricao: 'Respondeu a 10 janelas do Advento nesta edição.', conquistado: (advento.get(userId)?.size ?? 0) >= 10 },
  ];
  function top(mapa: Map<number, number>): Destaque[] {
    return pessoas.map((p) => ({ id: p.id, nome: p.name, avatar_url: p.avatar_url, total: mapa.get(p.id) ?? 0 }))
      .filter((p) => p.total > 0).sort((a, b) => b.total - a.total || a.id - b.id).slice(0, 3);
  }
  return { ano, user_id: userId, selos, ranking: [
    { id: 'fotos', titulo: 'Paparazzi da família', pessoas: top(fotos) },
    { id: 'comentarios', titulo: 'Prosa que não acaba', pessoas: top(comentarios) },
    { id: 'coracoes', titulo: 'Chuva de carinho', pessoas: top(coracoes) },
  ] };
}
