'use client';

import { createContext, useCallback, useContext, useState } from 'react';

type Kind = 'ok' | 'erro';
interface Toast { id: number; text: string; kind: Kind }

const Ctx = createContext<(text: string, kind?: Kind) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Kind = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, text, kind }]);
    setTimeout(() => setItems((xs) => xs.filter((t) => t.id !== id)), 3200);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`rise surface max-w-sm px-4 py-3 text-sm shadow-2xl ${
              t.kind === 'erro' ? 'border-cereja/60 text-marfim' : 'text-marfim'
            }`}
          >
            <span className={`mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle ${t.kind === 'erro' ? 'bg-cereja' : 'bg-champagne'}`} />
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

/** const toast = useToast(); toast('Publicado'); toast('Falhou', 'erro'); */
export function useToast() {
  return useContext(Ctx);
}
