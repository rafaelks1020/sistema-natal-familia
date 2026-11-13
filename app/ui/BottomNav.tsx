'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CircleUser, Home, PartyPopper, Users, Utensils } from 'lucide-react';

const CEIA = ['/ceia', '/vaquinha', '/contas-da-ceia', '/pagar', '/caronas', '/convidar', '/advento'];
const FESTA = ['/festa', '/karaoke', '/ao-vivo', '/telao'];
const FAMILIA = ['/familia', '/mural', '/album', '/memorias', '/receitas', '/historias', '/capsula', '/arvore', '/homenagem', '/playlist', '/cartao'];
const EU = ['/conta', '/pontos', '/conquistas', '/missoes', '/organizar', '/admin', '/convites'];

function pertence(path: string, bases: readonly string[]) {
  return bases.some((base) => path === base || path.startsWith(`${base}/`));
}

function abaAtiva(href: string, path: string) {
  if (href === '/') return path === '/';
  if (href === '/ceia') {
    if (pertence(path, ['/amigo-oculto/ao-vivo'])) return false;
    if (pertence(path, ['/amigo-oculto'])) return true;
    return pertence(path, CEIA);
  }
  if (href === '/festa') return pertence(path, ['/amigo-oculto/ao-vivo']) || pertence(path, FESTA);
  if (href === '/familia') return pertence(path, FAMILIA);
  if (href === '/conta') return pertence(path, EU);
  return false;
}

const TABS = [
  { href: '/', label: 'Hoje', icon: Home },
  { href: '/ceia', label: 'Ceia', icon: Utensils },
  { href: '/festa', label: 'Festa', icon: PartyPopper },
  { href: '/familia', label: 'Família', icon: Users },
  { href: '/conta', label: 'Eu', icon: CircleUser },
];

export default function BottomNav() {
  const path = usePathname() ?? '';
  return (
    <nav
      aria-label="Navegação principal"
      className="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-linha bg-carvao/92 backdrop-blur-md"
    >
      <ul className="mx-auto flex h-[var(--nav-h)] max-w-lg items-stretch justify-between px-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = abaAtiva(href, path);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex h-full flex-col items-center justify-center gap-1 text-[0.75rem] font-semibold transition-colors duration-300 ${
                  active ? 'text-marfim' : 'text-marfim-3'
                }`}
              >
                <Icon size={22} strokeWidth={active ? 1.9 : 1.5} className={active ? 'text-cereja' : ''} />
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
