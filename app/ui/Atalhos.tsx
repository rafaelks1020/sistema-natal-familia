import Link from 'next/link';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';

// Cartão de atalho grande: ícone em círculo, título, uma linha e seta.
// O mesmo desenho da antiga lista "Tudo do Natal", com a explicação legível no celular.

function idDoTitulo(titulo: string) {
  return `atalhos-${titulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

export default function Atalhos({ titulo, itens }: { titulo?: string; itens: { href: string; titulo: string; texto: string; icon: LucideIcon }[] }) {
  const headingId = titulo ? idDoTitulo(titulo) : undefined;
  return (
    <section aria-labelledby={headingId} aria-label={titulo ? undefined : 'Atalhos'}>
      {titulo ? <h2 id={headingId} className="kicker mb-3">{titulo}</h2> : null}
      <ul className="stagger divide-y divide-linha border-y border-linha">
        {itens.map(({ href, titulo: nome, texto, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-16 items-center gap-4 py-4 focus-visible:outline-2 focus-visible:outline-champagne">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-champagne/40 text-champagne">
                <Icon size={22} strokeWidth={1.5} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="display block text-2xl leading-tight">{nome}</span>
                <span className="mt-1 block text-sm text-marfim-2">{texto}</span>
              </span>
              <ArrowUpRight size={18} strokeWidth={1.5} className="shrink-0 text-champagne" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
