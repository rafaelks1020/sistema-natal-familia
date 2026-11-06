import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import t0 from '@/app/lib/tarefas/contagem';
import t1 from '@/app/lib/tarefas/advento';
import t2 from '@/app/lib/tarefas/vaquinha-meta';
import t3 from '@/app/lib/tarefas/capsula';
import t4 from '@/app/lib/tarefas/resumo-semanal';
import t5 from '@/app/lib/tarefas/lembretes';
import { c6Configurado } from '@/app/lib/c6';
import { conciliar } from '@/app/lib/pagamentos';

// Cron diário da Vercel (vercel.json, 12h UTC = 9h de São Paulo).
// Baixa Pix pagos e roda as tarefas das novidades (cada uma é idempotente).
const TAREFAS: [string, () => Promise<string>][] = [['contagem', t0], ['advento', t1], ['vaquinha-meta', t2], ['capsula', t3], ['resumo-semanal', t4], ['lembretes', t5]];
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${secret ?? ''}`);
  if (!secret || got.length !== want.length || !timingSafeEqual(got, want)) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }
  const resultado: Record<string, string> = {};
  for (const [nome, tarefa] of TAREFAS) {
    try {
      resultado[nome] = await tarefa();
    } catch (e) {
      console.error(`[cron diario] ${nome}`, (e as Error).message);
      resultado[nome] = `falhou: ${(e as Error).message.slice(0, 200)}`;
    }
  }
  // Pix por último: se o C6 demorar, os avisos do dia já saíram.
  try {
    resultado.pix = c6Configurado() ? JSON.stringify(await conciliar()) : 'C6 não configurado';
  } catch (e) {
    console.error('[cron diario] pix', (e as Error).message);
    resultado.pix = 'falhou';
  }
  return NextResponse.json({ ok: true, ...resultado });
}
