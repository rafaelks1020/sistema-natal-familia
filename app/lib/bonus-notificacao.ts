import { HttpError } from '@/app/lib/api';

/** Rota que viaja dentro do push. O código secreto só existe aqui e no banco. */
export const rotaDoBonus = (codigo: string) => `/bonus/${codigo}`;

/** Código url-safe (crypto.randomBytes(18) em base64url = 24 caracteres). */
export const CODIGO_BONUS_REGEX = /^[A-Za-z0-9_-]{16,64}$/;

export const TITULO_PADRAO_BONUS = 'Bônus surpresa da notificação';

/** Converte a falta das tabelas (migração 051 ainda não aplicada) em 503 com mensagem clara. */
export function erroBonus(err: unknown): never {
  if (err instanceof HttpError) throw err;
  if ((err as { code?: string } | null)?.code === '42P01') {
    throw new HttpError(503, 'A notificação com pontos surpresa ainda não está ativa.');
  }
  throw err;
}
