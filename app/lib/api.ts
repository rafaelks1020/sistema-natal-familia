import { NextResponse } from 'next/server';
import { getSessionUser, SessionUser } from './session';

// Padrão de toda rota de API:
//   export const POST = route(async (req, ctx) => { const user = await requireUser(); ... return ok(dado); });
// Erro de regra: throw new HttpError(400, 'mensagem para a pessoa'). Qualquer outro erro vira 500 genérico.

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, 'Entre com seu usuário para continuar.');
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.is_admin) throw new HttpError(403, 'Só quem organiza pode fazer isso.');
  return user;
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      console.error(`[api] ${req.method} ${new URL(req.url).pathname}:`, err);
      return NextResponse.json({ error: 'Algo deu errado. Tente de novo.' }, { status: 500 });
    }
  };
}

/** Lê o corpo JSON; corpo inválido vira 400. */
export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'Dados inválidos.');
  }
}

export function toInt(value: unknown, field = 'id'): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `Campo ${field} inválido.`);
  return n;
}

export function cleanText(value: unknown, field: string, max = 2000, required = true): string {
  const s = typeof value === 'string' ? value.trim() : '';
  if (required && !s) throw new HttpError(400, `Preencha ${field}.`);
  if (s.length > max) throw new HttpError(400, `${field} passou de ${max} caracteres.`);
  return s;
}
