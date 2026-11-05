import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { c6Configurado } from '@/app/lib/c6';
import { conciliar } from '@/app/lib/pagamentos';

// Cron da Vercel (vercel.json): baixa Pix pagos que ninguém abriu a tela para conferir.
// A Vercel manda "Authorization: Bearer <CRON_SECRET>".
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${secret ?? ''}`);
  if (!secret || got.length !== want.length || !timingSafeEqual(got, want)) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }
  if (!c6Configurado()) return NextResponse.json({ ok: true, pulado: 'C6 não configurado' });
  try {
    return NextResponse.json({ ok: true, ...(await conciliar()) });
  } catch (e) {
    console.error('[cron conciliar]', (e as Error).message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
