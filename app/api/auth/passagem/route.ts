import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import { HttpError, ok, requireUser, route } from '@/app/lib/api';
import { createHandoffCode, getSessionUser, readHandoffCode, setSessionCookie } from '@/app/lib/session';

// Passagem do app nativo para o navegador do celular, para a pessoa não ter de digitar usuário e senha de novo quando o
// app abre uma tela que só existe no site (karaokê, missões, jogos da noite).
//
// POST /api/auth/passagem                 -> { codigo } para quem está logado (o app manda o Bearer no cabeçalho)
// GET  /api/auth/passagem?c=<codigo>&para=/caminho -> troca o código pelo cookie de sessão e leva para a tela pedida
//
// O código vale 45 segundos, é assinado pelo servidor e não serve como token de sessão. O token de verdade nunca vai na URL.

export const dynamic = 'force-dynamic';

/** Só caminho interno do site: nada de outro domínio, de "//host" nem de rota de API. */
function caminhoSeguro(para: string | null): string {
  if (!para || para.length > 300) return '/';
  if (!para.startsWith('/') || para.startsWith('//') || para.includes('\\') || para.includes('\n') || para.includes('\r')) return '/';
  if (para === '/api' || para.startsWith('/api/')) return '/';
  return para;
}

export const POST = route(async () => {
  const me = await requireUser();
  const { rows } = await query<{ session_version: number }>(
    'SELECT session_version FROM family_users WHERE id = $1',
    [me.id],
  );
  const versao = Number(rows[0]?.session_version);
  if (!Number.isInteger(versao) || versao < 1) throw new HttpError(401, 'Entre com seu usuário para continuar.');
  const res = ok({ codigo: createHandoffCode(me.id, versao) });
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const res = NextResponse.redirect(new URL(caminhoSeguro(url.searchParams.get('para')), url.origin), 303);
  res.headers.set('Cache-Control', 'private, no-store');
  res.headers.set('Referrer-Policy', 'no-referrer');
  try {
    // Navegador que já tem alguém logado fica como está: a passagem nunca troca uma sessão por outra.
    if (await getSessionUser()) return res;
    const passe = readHandoffCode(url.searchParams.get('c'));
    if (!passe) return res; // código vencido ou inválido: a tela pedida manda para /entrar
    const { rows } = await query<{ id: number }>(
      'SELECT id FROM family_users WHERE id = $1 AND session_version = $2',
      [passe.uid, passe.v],
    );
    if (rows[0]) setSessionCookie(res, passe.uid, passe.v);
  } catch (err) {
    console.error('[passagem]', err instanceof Error ? err.message : 'falha');
  }
  return res;
}
