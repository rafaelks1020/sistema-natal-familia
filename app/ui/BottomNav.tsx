'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Gift, Home, Images, MessageCircle, Wallet } from 'lucide-react';

const TABS = [
  { href: '/', label: 'Início', icon: Home },
  { href: '/mural', label: 'Mural', icon: MessageCircle },
  { href: '/amigo-oculto', label: 'Amigo oculto', icon: Gift },
  { href: '/vaquinha', label: 'Vaquinha', icon: Wallet },
  { href: '/album', label: 'Álbum', icon: Images },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Navegação principal"
      className="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-linha bg-carvao/92 backdrop-blur-md"
    >
      <ul className="mx-auto flex h-[var(--nav-h)] max-w-lg items-stretch justify-between px-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? path === '/' : path.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex h-full flex-col items-center justify-center gap-1 text-[0.68rem] font-medium transition-colors duration-300 ${
                  active ? 'text-marfim' : 'text-marfim-3'
                }`}
              >
                <Icon size={21} strokeWidth={active ? 1.9 : 1.5} className={active ? 'text-cereja' : ''} />
                {label}
                {active && <span className="absolute top-0 h-px w-8 bg-cereja" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
