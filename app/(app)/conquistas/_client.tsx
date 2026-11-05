'use client';

import Link from 'next/link';
import { Award, Heart, Lock } from 'lucide-react';
import PageHeader from '@/app/ui/PageHeader';
import Avatar from '@/app/ui/Avatar';
import type { Conquistas } from '@/app/lib/conquistas';

export default function ConquistasClient({ initial: dados }: { initial: Conquistas }) {
  return <><PageHeader kicker={`Nosso Natal de ${dados.ano}`} title="Conquistas" back="/" />
    <div className="space-y-8 px-5 pb-10">
      <p className="text-sm text-marfim-2">Cada gesto vira uma lembrança. Os selos celebram seu jeito de participar.</p>
      <section aria-label="Todos os selos" className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">{dados.selos.map((s) => <article key={s.id} className={`surface min-w-0 p-4 ${s.conquistado ? 'border-champagne/40' : ''}`}>
        {s.conquistado ? <Award size={24} className="text-champagne" aria-hidden /> : <Lock size={22} className="text-marfim-3" aria-hidden />}
        <h2 className="mt-3 break-words font-medium">{s.nome}</h2><p className="mt-1 text-xs leading-relaxed text-marfim-3">{s.descricao}</p><p className={`mt-3 text-xs ${s.conquistado ? 'text-champagne' : 'text-marfim-3'}`}>{s.conquistado ? 'Conquistado' : 'Ainda por conquistar'}</p>
      </article>)}</section>
      <section className="space-y-5"><div><p className="kicker">Uma brincadeira da edição</p><h2 className="display mt-2 text-3xl">Destaques da família</h2><p className="mt-2 text-sm text-marfim-3">Um aplauso para quem espalhou memórias e carinho. Aqui todo mundo tem lugar.</p></div>
        {dados.ranking.map((r) => <article key={r.id} className="surface p-5"><h3 className="display text-2xl">{r.titulo}</h3>{!r.pessoas.length && <p className="mt-3 text-sm text-marfim-3">As primeiras participações vão aparecer aqui.</p>}<ol className="mt-3 divide-y divide-linha">{r.pessoas.map((p) => <li key={p.id}><Link href={`/familia/${p.id}`} className="flex min-h-16 items-center gap-3 py-3"><Avatar name={p.nome} src={p.avatar_url} size={40} /><span className="min-w-0 flex-1 break-words text-sm">{p.nome}</span><span className="shrink-0 text-sm text-champagne">{p.total} {r.id === 'fotos' ? 'fotos' : r.id === 'comentarios' ? 'comentários' : 'curtidas'}</span><Heart size={14} className="shrink-0 text-champagne" aria-hidden /></Link></li>)}</ol></article>)}
      </section>
    </div></>;
}
