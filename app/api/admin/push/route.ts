import { ok, requireAdmin, route } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { enviarPushAgora } from '@/app/lib/push';
import { vapidPronto } from '@/app/lib/push-web';

export const runtime = 'nodejs';

const VAZIO = { ios: 0, android: 0, web: 0 };

export const GET = route(async () => {
  await requireAdmin();
  const [contagem, linhas, sem] = await Promise.all([
    query<{ platform: string; total: number }>(
      `SELECT platform, count(*)::int AS total
         FROM push_devices
        WHERE disabled_at IS NULL
        GROUP BY platform`,
    ),
    query<{ id: number; nome: string; plataforma: string; last_seen_at: string }>(
      `SELECT u.id, u.name AS nome, d.platform AS plataforma, d.last_seen_at::text AS last_seen_at
         FROM family_users u
         JOIN push_devices d ON d.user_id = u.id AND d.disabled_at IS NULL
        ORDER BY u.name, d.id`,
    ),
    query<{ total: number }>(
      `SELECT count(*)::int AS total
         FROM family_users u
        WHERE NOT EXISTS (
          SELECT 1 FROM push_devices d
           WHERE d.user_id = u.id AND d.disabled_at IS NULL
        )`,
    ),
  ]);
  const porPlataforma = { ...VAZIO };
  for (const row of contagem.rows) {
    if (row.platform === 'ios' || row.platform === 'android' || row.platform === 'web') {
      porPlataforma[row.platform] = Number(row.total);
    }
  }
  const pessoas: { id: number; nome: string; aparelhos: { plataforma: string; last_seen_at: string }[] }[] = [];
  for (const linha of linhas.rows) {
    let pessoa = pessoas.find((item) => item.id === linha.id);
    if (!pessoa) {
      pessoa = { id: linha.id, nome: linha.nome, aparelhos: [] };
      pessoas.push(pessoa);
    }
    pessoa.aparelhos.push({ plataforma: linha.plataforma, last_seen_at: linha.last_seen_at });
  }
  return ok({
    porPlataforma,
    semAparelho: Number(sem.rows[0]?.total ?? 0),
    webConfigurado: vapidPronto({
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
      subject: process.env.VAPID_SUBJECT,
    }),
    pessoas,
  });
});

export const POST = route(async () => {
  const me = await requireAdmin();
  const resultado = await enviarPushAgora([me.id], {
    titulo: 'Notificação de teste',
    corpo: 'Se você está lendo isto, o aviso do Natal em Família chegou.',
    rota: '/admin/notificacoes',
  });
  return ok({ ok: true, ...resultado });
});
