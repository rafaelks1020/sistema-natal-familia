import { query, transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { enviarPush } from '@/app/lib/push';

export async function consultarMeta() {
  const ano = edicaoAtual();
  const [settings, total] = await Promise.all([
    query<{ key: string; value: string }>(`SELECT key, value FROM app_settings WHERE key = ANY($1::text[])`,
      [['vaquinha_meta_centavos', 'vaquinha_destino', 'vaquinha_ano']]),
    query<{ centavos: string; pessoas: number }>(
      `SELECT COALESCE(ROUND(SUM(amount) * 100), 0)::text AS centavos,
              COUNT(DISTINCT participant_id)::int AS pessoas FROM payments
        WHERE status = 'PAID' AND created_at >= $1::timestamp AND created_at < $2::timestamp`,
      [`${ano}-03-01 00:00:00`, `${ano + 1}-03-01 00:00:00`]),
  ]);
  const config = Object.fromEntries(settings.rows.map(r => [r.key, r.value]));
  const ativa = Number(config.vaquinha_ano) === ano;
  const meta_centavos = ativa ? Math.max(0, Number(config.vaquinha_meta_centavos) || 0) : 0;
  const arrecadado_centavos = Number(total.rows[0]?.centavos || 0);
  let avisos = 0;
  for (const marco of [50, 100]) {
    if (!meta_centavos || arrecadado_centavos * 100 < meta_centavos * marco) continue;
    const users = await transaction(async q => {
      const result = await q(
        `INSERT INTO app_settings(key, value, updated_at) VALUES ($1, 'enviado', NOW())
         ON CONFLICT (key) DO NOTHING RETURNING key`, [`vaquinha_meta_push_${ano}_${marco}`]);
      if (!result.rowCount) return null;
      return (await q<{ id: number }>('SELECT id FROM family_users')).rows.map(u => u.id);
    });
    if (!users) continue;
    void enviarPush(users, {
      titulo: marco === 100 ? 'Batemos a meta da vaquinha!' : 'Já chegamos à metade da meta!',
      corpo: 'Cada contribuição faz nosso Natal acontecer. Acompanhe a vaquinha.', rota: '/vaquinha',
    });
    avisos++;
  }
  return { meta_centavos, destino: ativa ? config.vaquinha_destino || '' : '',
    arrecadado_centavos, contribuintes: Number(total.rows[0]?.pessoas || 0), avisos };
}
