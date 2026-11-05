'use client';
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AlbumItem } from '@/app/api/album/types';
import type { MemoryEdition } from '@/app/api/memorias/types';
import PageHeader from '@/app/ui/PageHeader';
import { thumb } from '@/app/ui/thumb';
import { PhotoDialog } from '../album/_client';

export function MemoryPhoto({ photo, onOpen }: { photo: AlbumItem; onOpen?: () => void }) {
  const [open, setOpen] = useState(false); const router = useRouter();
  return <><button className="block min-h-11 w-full overflow-hidden rounded-xl text-left" aria-label={`Abrir foto de ${photo.author_name}`} onClick={() => { setOpen(true); onOpen?.(); }}><img src={thumb(photo.url, 640)} alt={photo.caption || 'Memória da família'} className="aspect-square w-full object-cover" loading="lazy" /><span className="block py-2 text-xs text-marfim-2">{photo.author_name} · {photo.ano}</span></button>
    {open && <PhotoDialog photo={{ ...photo, can_edit: false }} people={[]} onClose={() => setOpen(false)} onUpdate={() => router.refresh()} onDelete={() => { setOpen(false); router.refresh(); }} onNavigate={() => {}} />}</>;
}
export function EditionCard({ edition }: { edition: MemoryEdition }) {
  return <article className="overflow-hidden rounded-2xl border border-linha bg-carvao-2">
    {edition.cover && <img src={thumb(edition.cover, 828)} alt={`Capa do Natal de ${edition.ano}`} loading="lazy" className="aspect-[4/3] w-full object-cover" />}
    <div className="space-y-4 p-5"><p className="kicker">Natal em família</p><h2 className="display text-4xl">{edition.ano}</h2>
      <p className="text-sm text-marfim-2">{edition.photos} fotos · {edition.comments} comentários · {edition.people} pessoas</p>
      {edition.topPoster && <p className="text-sm text-marfim-2">Quem mais compartilhou: {edition.topPoster.name}</p>}
      <div className="grid grid-cols-3 gap-2">{edition.highlights.map(p => <MemoryPhoto key={p.key} photo={p} />)}</div>
      <div className="flex flex-wrap gap-2"><Link className="btn btn-ghost" href={`/album?ano=${edition.ano}`}>Ver álbum</Link><Link className="btn btn-ghost" href={`/memorias/livro/${edition.ano}`}>Livro de fotos</Link>
        {edition.available ? <Link className="btn btn-primary" href={`/memorias/retrospectiva/${edition.ano}`}>Reviver este Natal</Link> : <p className="text-sm text-marfim-3">Retrospectiva em 25/12/{edition.ano}</p>}</div>
    </div>
  </article>;
}
export default function MemoriesClient({ today, editions, timeline = false }: { today: AlbumItem[]; editions: MemoryEdition[]; timeline?: boolean }) {
  return <div className="pb-28"><PageHeader title={timeline ? 'Linha do tempo' : 'Nossas memórias'} kicker="Cada Natal tem uma história" back={timeline ? '/memorias' : '/album'} />
    <div className="space-y-6 px-5">{!timeline && <section className="space-y-4 rounded-2xl border border-linha bg-carvao-2 p-4"><p className="kicker">Neste dia</p><h2 className="display text-2xl">Lembra deste momento?</h2>
      {today.length ? <div className="grid grid-cols-2 gap-3">{today.map(p => <MemoryPhoto key={p.key} photo={p} />)}</div> : <p className="text-sm text-marfim-2">Ainda não temos fotos de outros Natais tiradas neste mesmo dia e mês. Continue guardando os momentos da família.</p>}
      <Link className="btn btn-ghost w-full" href="/memorias/linha-do-tempo">Explorar a linha do tempo</Link>
    </section>}
    {!editions.length && <p className="rounded-2xl bg-carvao-2 p-6 text-marfim-2">A nossa história começa com a primeira foto. Adicione os registros de 2025 ao álbum.</p>}
    {editions.map(e => <EditionCard key={e.ano} edition={e} />)}
    </div>
  </div>;
}
