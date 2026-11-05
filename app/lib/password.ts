import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

// Mesmo formato do sistema antigo (salt:hash em hex, scrypt 64 bytes).

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const hash = scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (keyBuf.length !== hash.length) return false;
  return timingSafeEqual(keyBuf, hash);
}
