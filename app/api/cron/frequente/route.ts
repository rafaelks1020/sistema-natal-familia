import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

// Cron de 5 em 5 minutos (crontab da VPS chama com Authorization: Bearer <CRON_SECRET>).
// A Vercel só roda o cron dela uma vez por dia; os avisos agendados precisam de hora certa.
const TAREFAS = ['avisos-agendados', 'playlist-ordem'] as const;
export const maxDuration = 30;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${secret ?? ''}`);
  if (!secret || got.length !== want.length || !timingSafeEqual(got, want)) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }
  const resultado: Record<string, string> = {};
  for (const nome of TAREFAS) {
    try {
      const mod = (await import(`@/app/lib/tarefas/${nome}`)) as { default?: () => Promise<string> };
      resultado[nome] = mod.default ? await mod.default() : 'sem tarefa';
    } catch (e) {
      console.error(`[cron frequente] ${nome}`, (e as Error).message);
      resultado[nome] = 'falhou';
    }
  }
  return NextResponse.json({ ok: true, ...resultado });
}
