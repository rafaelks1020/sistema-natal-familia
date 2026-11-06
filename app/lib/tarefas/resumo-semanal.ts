import { query } from '@/app/lib/db';
import { hojeSP } from '@/app/lib/edicao';
import { enviarPush } from '@/app/lib/push';
import { diasAte } from './contagem';

// Cada contagem olha só os últimos 7 dias. A tabela só entra se existir (to_regclass).
const FONTES: { chave: string; tabela: string; sql: string; um: string; varios: string }[] = [
  {
    chave: 'fotos_posts', tabela: 'family_posts', um: 'foto nova', varios: 'fotos novas',
    sql: "SELECT COUNT(*)::int AS n FROM family_posts WHERE image_url IS NOT NULL AND image_url <> '' AND created_at >= NOW() - INTERVAL '7 days'",
  },
  {
    chave: 'fotos_album', tabela: 'album_photos', um: 'foto nova', varios: 'fotos novas',
    sql: "SELECT COUNT(*)::int AS n FROM album_photos WHERE created_at >= NOW() - INTERVAL '7 days'",
  },
  {
    chave: 'comentarios', tabela: 'family_post_comments', um: 'comentário', varios: 'comentários',
    sql: "SELECT COUNT(*)::int AS n FROM family_post_comments WHERE created_at >= NOW() - INTERVAL '7 days'",
  },
  {
    chave: 'receitas', tabela: 'family_recipes', um: 'receita', varios: 'receitas',
    sql: "SELECT COUNT(*)::int AS n FROM family_recipes WHERE created_at >= NOW() - INTERVAL '7 days'",
  },
  {
    chave: 'historias', tabela: 'family_stories', um: 'história', varios: 'histórias',
    sql: "SELECT COUNT(*)::int AS n FROM family_stories WHERE created_at >= NOW() - INTERVAL '7 days'",
  },
  {
    chave: 'musicas', tabela: 'playlist_tracks', um: 'música', varios: 'músicas',
    sql: "SELECT COUNT(*)::int AS n FROM playlist_tracks WHERE created_at >= NOW() - INTERVAL '7 days'",
  },
  {
    chave: 'advento', tabela: 'advent_responses', um: 'resposta do Advento', varios: 'respostas do Advento',
    sql: "SELECT COUNT(*)::int AS n FROM advent_responses WHERE created_at >= NOW() - INTERVAL '7 days'",
  },
];

function domingo(hoje: string): boolean {
  return new Date(`${hoje}T12:00:00Z`).getUTCDay() === 0;
}

function fraseDias(dias: number | null): string {
  if (dias === null || dias < 0) return '';
  if (dias === 0) return 'A ceia é hoje!';
  return `Falta${dias === 1 ? '' : 'm'} ${dias} dia${dias === 1 ? '' : 's'} para a ceia!`;
}

export default async function tarefa(): Promise<string> {
  const hoje = hojeSP();
  if (!domingo(hoje)) return 'Resumo semanal: hoje não é domingo.';

  // Marca antes de enviar: um segundo disparo no mesmo domingo não repete o aviso.
  const marca = await query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, 'enviado', NOW())
     ON CONFLICT (key) DO NOTHING RETURNING key`,
    [`resumo-semanal:${hoje}`],
  );
  if (!marca.rows.length) return `Resumo semanal: ${hoje} já enviado.`;

  const { rows: existentes } = await query<{ tabela: string; existe: string | null }>(
    `SELECT t AS tabela, to_regclass('public.' || t)::text AS existe FROM unnest($1::text[]) AS t`,
    [FONTES.map((f) => f.tabela)],
  );
  const presentes = new Set(existentes.filter((e) => e.existe).map((e) => e.tabela));

  const contagens = new Map<string, number>();
  for (const fonte of FONTES) {
    if (!presentes.has(fonte.tabela)) continue;
    const { rows } = await query<{ n: number }>(fonte.sql);
    contagens.set(fonte.chave, Number(rows[0]?.n ?? 0));
  }

  const fotos = (contagens.get('fotos_posts') ?? 0) + (contagens.get('fotos_album') ?? 0);
  const itens: string[] = [];
  const somar = (n: number, um: string, varios: string) => { if (n > 0) itens.push(`${n} ${n === 1 ? um : varios}`); };
  somar(fotos, 'foto nova', 'fotos novas');
  for (const fonte of FONTES) {
    if (fonte.chave.startsWith('fotos_')) continue;
    somar(contagens.get(fonte.chave) ?? 0, fonte.um, fonte.varios);
  }

  const { rows: settings } = await query<{ value: string }>("SELECT value FROM app_settings WHERE key = 'event_date'");
  const dias = settings[0]?.value ? diasAte(settings[0].value, hoje) : null;
  const final = fraseDias(dias);

  const titulo = itens.length ? 'Resumo da semana' : 'Que tal postar uma foto antiga?';
  const corpo = itens.length
    ? `Nesta semana: ${itens.join(', ')}.${final ? ` ${final}` : ''}`
    : `Foi uma semana quieta por aqui. Que tal postar uma foto antiga?${final ? ` ${final}` : ''}`;

  const { rows: pessoas } = await query<{ id: number }>('SELECT id FROM family_users');
  await enviarPush(pessoas.map((p) => Number(p.id)), { titulo, corpo, rota: '/' });
  return `Resumo semanal: ${itens.length ? 'enviado' : 'convite enviado'} para ${pessoas.length} pessoa(s).`;
}
