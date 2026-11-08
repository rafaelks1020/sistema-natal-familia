import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import t0 from '@/app/lib/tarefas/avisos-agendados';
import t1 from '@/app/lib/tarefas/playlist-ordem';
import t2 from '@/app/lib/tarefas/gamificacao';

// Cron de 5 em 5 minutos (crontab da VPS chama com Authorization: Bearer <CRON_SECRET>).
// A Vercel só roda o cron dela uma vez por dia; os avisos agendados precisam de hora certa.
const TAREFAS: [string, () => Promise<string>][] = [['avisos-agendados', t0], ['playlist-ordem', t1], ['gamificacao', t2]];
export const maxDuration = 30;

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
      console.error(`[cron frequente] ${nome}`, (e as Error).message);
      resultado[nome] = `falhou: ${(e as Error).message.slice(0, 200)}`;
    }
  }
  return NextResponse.json({ ok: true, ...resultado });
}
