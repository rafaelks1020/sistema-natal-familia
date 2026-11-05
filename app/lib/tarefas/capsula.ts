import { query } from '@/app/lib/db';
import { hojeSP } from '@/app/lib/edicao';
import { enviarPush } from '@/app/lib/push';
import { revelarAbertas } from '@/app/api/capsula/_data';

// No dia em que alguma cápsula abre, avisa a família uma vez.
// A marca em app_settings impede um segundo aviso. O texto só sai do lacre
// quando abre_em já passou (revelarAbertas).
export default async function tarefa(): Promise<string> {
  const hoje = hojeSP();
  const reveladas = await revelarAbertas();
  const { rows } = await query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM time_capsules
     WHERE (abre_em AT TIME ZONE 'America/Sao_Paulo')::date = $1::date`,
    [hoje],
  );
  const total = rows[0]?.n ?? 0;
  if (!total) return `Cápsula: nenhuma abertura hoje. ${reveladas} revelada(s).`;
  const gravado = await query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, 'enviado', NOW())
     ON CONFLICT (key) DO NOTHING RETURNING key`,
    [`capsula_push_${hoje}`],
  );
  if (!gravado.rows[0]) return `Cápsula: ${hoje} já avisado.`;
  const { rows: pessoas } = await query<{ id: number }>('SELECT id FROM family_users');
  const ids = pessoas.map((row) => Number(row.id));
  const { rows: estado } = await query<{ aberta: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM time_capsules
       WHERE (abre_em AT TIME ZONE 'America/Sao_Paulo')::date = $1::date AND abre_em <= NOW()
     ) AS aberta`,
    [hoje],
  );
  await enviarPush(ids, {
    titulo: 'Cápsula do tempo',
    corpo: estado[0]?.aberta
      ? 'As mensagens guardadas pela família já podem ser lidas.'
      : 'Hoje a cápsula do tempo abre na ceia.',
    rota: '/capsula',
  });
  return `Cápsula: aviso de ${hoje} para ${ids.length} pessoas.`;
}
