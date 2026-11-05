'use client';

import { createContext, useContext } from 'react';
import type { SessionUser } from '@/app/lib/session';

// Usuário logado, vindo do layout (servidor). Use: const me = useMe();

const Ctx = createContext<SessionUser | null>(null);

export function UserProvider({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return <Ctx.Provider value={user}>{children}</Ctx.Provider>;
}

export function useMe(): SessionUser {
  const u = useContext(Ctx);
  if (!u) throw new Error('useMe fora do UserProvider');
  return u;
}
