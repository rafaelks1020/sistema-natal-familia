import { query } from '@/app/lib/db';
import { edicaoAtual, hojeSP } from '@/app/lib/edicao';
import { enviarPush } from '@/app/lib/push';

export type MotivoLembrete = 'presenca' | 'vaquinha';
export type Pessoa = { id: number; nome: string };
export type Ficha = { sem_presenca: Pessoa[]; sem_pagamento: Pessoa[] };

const MENSAGENS: Record<MotivoLembrete, { titulo: string; corpo: string; rota: string }> = {
  presenca: { titulo: 'Você vem na ceia?', corpo: 'Confirme em 1 toque.', rota: '/ceia' },
  vaquinha: { titulo: 'Vaquinha da ceia', corpo: 'Falta a sua parte na vaquinha.', rota: '/vaquinha' },
};

/**
 * Quem ainda não respondeu a presença (sim, talvez ou não) e quem não tem pagamento
 * na vaquinha da edição (PIX pago ou baixa manual, como a tela da vaquinha soma).
 * Só entra quem tem vínculo com um participante.
 */
export async function montarFicha(): Promise<Ficha> {
  const ano = edicaoAtual();
  const inicio = `${ano}-03-01 00:00:00`;
  const fim = `${ano + 1}-03-01 00:00:00`;
  const [presenca, pagamento] = await Promise.all([
    query<{ id: number; nome: string }>(
      `SELECT u.id, u.name AS nome
         FROM family_users u
         JOIN participants p ON p.user_id = u.id
        WHERE NOT EXISTS (
          SELECT 1 FROM family_attendance a
           WHERE a.participant_id = p.id
             AND a.status IN ('yes', 'maybe', 'no')
             AND (a.ano IS NULL OR a.ano = $1)
        )
        GROUP BY u.id, u.name
        ORDER BY u.name, u.id`, [ano],
    ),
    query<{ id: number; nome: string }>(
      `SELECT u.id, u.name AS nome
         FROM family_users u
         JOIN participants p ON p.user_id = u.id
        WHERE COALESCE(p.paid, false) = false
          AND NOT EXISTS (
            SELECT 1 FROM payments y
             WHERE y.participant_id = p.id AND y.status = 'PAID'
               AND y.created_at >= $1::timestamp AND y.created_at < $2::timestamp
          )
        GROUP BY u.id, u.name
        ORDER BY u.name, u.id`, [inicio, fim],
    ),
  ]);
  const mapa = (rows: { id: number; nome: string }[]) => rows.map((r) => ({ id: Number(r.id), nome: r.nome }));
  return { sem_presenca: mapa(presenca.rows), sem_pagamento: mapa(pagamento.rows) };
}

function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Manda o lembrete só para quem ainda está na ficha do motivo e passou do limite.
 * O limite fica em app_settings (lembrete:<edição>:<motivo>:<pessoa> = data do último envio):
 * automático espera 7 dias (ou 1 dia nos últimos 3 dias), manual espera 1 dia.
 * A marca é gravada de forma atômica antes do push, então dois disparos não repetem.
 */
export async function enviarLembrete(
  motivo: MotivoLembrete,
  opcoes: { userIds?: number[]; intervaloDias: number; ficha?: Ficha },
): Promise<{ enviados: number; elegiveis: number }> {
  const ficha = opcoes.ficha ?? await montarFicha();
  const lista = motivo === 'presenca' ? ficha.sem_presenca : ficha.sem_pagamento;
  const filtro = opcoes.userIds ? new Set(opcoes.userIds) : null;
  const ids = lista.map((p) => p.id).filter((id) => !filtro || filtro.has(id));
  if (!ids.length) return { enviados: 0, elegiveis: 0 };

  const ano = edicaoAtual();
  const hoje = hojeSP();
  const limite = somarDias(hoje, -opcoes.intervaloDias);
  // Envia se o último envio foi em data igual ou anterior ao limite (datas ISO comparam como texto).
  const { rows } = await query<{ key: string }>(
    `INSERT INTO app_settings (key, value, updated_at)
     SELECT 'lembrete:' || $1::text || ':' || $2::text || ':' || u, $3::text, NOW()
       FROM unnest($4::int[]) AS u
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      WHERE app_settings.value <= $5::text
     RETURNING key`,
    [ano, motivo, hoje, ids, limite],
  );
  const enviar = rows.map((r) => Number(r.key.split(':').pop())).filter((id) => Number.isInteger(id));
  if (enviar.length) await enviarPush(enviar, MENSAGENS[motivo]);
  return { enviados: enviar.length, elegiveis: ids.length };
}
