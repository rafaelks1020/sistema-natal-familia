import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

// Cabeçalho editorial das telas: kicker em champagne, título em Bodoni, ação opcional à direita.

interface Props {
  kicker?: string;
  title: string;
  back?: string;
  action?: React.ReactNode;
}

export default function PageHeader({ kicker, title, back, action }: Props) {
  return (
    <header className="rise flex items-end justify-between gap-4 px-5 pb-5 pt-[calc(env(safe-area-inset-top)+20px)]">
      <div className="min-w-0">
        {back && (
          <Link href={back} className="mb-3 -ml-1 inline-flex items-center gap-1 text-sm text-marfim-2">
            <ChevronLeft size={18} strokeWidth={1.5} /> Voltar
          </Link>
        )}
        {kicker && <p className="kicker mb-2">{kicker}</p>}
        <h1 className={`display text-balance ${title.length > 14 ? 'text-[2rem]' : 'text-[2.4rem]'}`}>{title}</h1>
      </div>
      {action && <div className="shrink-0 pb-1">{action}</div>}
    </header>
  );
}
