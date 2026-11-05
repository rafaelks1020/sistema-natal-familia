import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

// Mesmo formato do sistema antigo (salt:hash em hex, scrypt 64 bytes).
// Assíncrono: o scrypt não trava as outras requisições enquanto calcula.
const scrypt = promisify(scryptCb) as (senha: string, salt: string, tamanho: number) => Promise<Buffer>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const hash = await scrypt(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (keyBuf.length !== hash.length) return false;
  return timingSafeEqual(keyBuf, hash);
}
