import { situacaoAdvento } from '../advento';
import { query } from '../db';
import { enviarPush } from '../push';

// Uma vez por dia, de 1 a 24/12, avisa a família que a janela abriu.
// A marca em app_settings impede um segundo aviso no mesmo dia.
export default async function tarefa(): Promise<string> {
  const s = situacaoAdvento();
  if (s.hoje < `${s.ano}-12-01` || s.hoje > `${s.ano}-12-24`) return 'Advento: fora dos dias 1 a 24.';
  const dia = Number(s.hoje.slice(8, 10));
  const chave = `advento_push_${s.hoje}`;
  const gravado = await query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO NOTHING
     RETURNING key`,
    [chave, String(dia)],
  );
  if (!gravado.rows[0]) return `Advento: dia ${dia} já avisado.`;
  const pessoas = await query<{ id: number }>('SELECT id FROM family_users');
  const ids = pessoas.rows.map((row) => Number(row.id));
  await enviarPush(ids, {
    titulo: 'Calendário do Advento',
    corpo: `A janela do dia ${dia} abriu`,
    rota: '/advento',
  });
  return `Advento: aviso do dia ${dia} para ${ids.length} pessoas.`;
}
