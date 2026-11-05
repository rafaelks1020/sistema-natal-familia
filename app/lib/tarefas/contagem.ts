import { query } from '@/app/lib/db';
import { edicaoAtual, hojeSP } from '@/app/lib/edicao';
import { enviarPush } from '@/app/lib/push';

const MARCOS = new Set([30, 15, 10, 7, 5, 3, 2, 1, 0]);

// A subtração usa dias de calendário, sem diferença de horas ou horário de verão.
export function diasAte(data: string, hoje = hojeSP()): number | null {
  const valor = /^\d{4}-\d{2}-\d{2}$/.test(data) ? `${data}T12:00:00-03:00` : data;
  const instante = new Date(valor);
  if (!Number.isFinite(instante.getTime())) return null;
  return Math.round((Date.parse(`${hojeSP(instante)}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86400000);
}

export default async function tarefa(): Promise<string> {
  const ano = edicaoAtual();
  const hoje = hojeSP();
  const { rows: settings } = await query<{ key: string; value: string }>(
    "SELECT key, value FROM app_settings WHERE key IN ('event_date', 'event_title')",
  );
  const valores = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const avisos: { chave: string; titulo: string; corpo: string; rota: string }[] = [];
  const dias = valores.event_date ? diasAte(valores.event_date, hoje) : null;
  if (dias !== null && MARCOS.has(dias)) {
    const titulo = valores.event_title?.trim() || 'Ceia de Natal';
    avisos.push({ chave: 'ceia', titulo: dias === 0 ? 'É hoje!' : `Falta${dias === 1 ? '' : 'm'} ${dias} dia${dias === 1 ? '' : 's'} para a ${titulo}!`, corpo: dias === 0 ? `Hoje é dia de ${titulo}. Esperamos você!` : 'Nosso encontro está chegando. Confira os preparativos.', rota: '/' });
  }
  const { rows: tabelas } = await query<{ existe: string | null }>("SELECT to_regclass('public.secret_santa_config')::text AS existe");
  if (tabelas[0]?.existe) {
    const { rows } = await query<{ id: number; reveal_date: string }>(
      `SELECT c.id, c.reveal_date::text FROM secret_santa_config c
        WHERE c.is_active AND c.reveal_date IS NOT NULL
          AND COALESCE((to_jsonb(c)->>'ano')::int, EXTRACT(YEAR FROM c.created_at - INTERVAL '2 months')::int) = $1
        ORDER BY c.id DESC LIMIT 1`, [ano],
    );
    // reveal_date é TIMESTAMP sem fuso: a configuração representa a hora local da família.
    const data = rows[0]?.reveal_date;
    if (data && diasAte(`${data.replace(' ', 'T')}-03:00`, hoje) === 1) {
      avisos.push({ chave: 'amigo', titulo: 'A revelação do amigo oculto é amanhã!', corpo: 'Prepare o presente e venha descobrir os segredos da família.', rota: '/amigo-oculto' });
    }
  }
  if (!avisos.length) return 'Contagem: nenhum lembrete hoje.';
  const { rows: pessoas } = await query<{ id: number }>('SELECT id FROM family_users');
  let enviados = 0;
  for (const aviso of avisos) {
    const { rows } = await query(
      `INSERT INTO app_settings(key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO NOTHING RETURNING key`,
      [`contagem:${ano}:${aviso.chave}:${hoje}`, 'enviado'],
    );
    if (!rows.length) continue;
    void enviarPush(pessoas.map((p) => p.id), { titulo: aviso.titulo, corpo: aviso.corpo, rota: aviso.rota });
    enviados++;
  }
  return `Contagem: ${enviados} lembrete(s) agendado(s).`;
}
