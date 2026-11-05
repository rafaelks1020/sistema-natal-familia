'use client';
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useState } from 'react';
import type { AlbumItem } from '@/app/api/album/types';
import { PhotoDialog } from '../../../album/_client';
export default function PhotoBook({ ano, photos, cover }: { ano: number; photos: AlbumItem[]; cover: string | null }) {
  const [selected, setSelected] = useState<AlbumItem | null>(null); const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const mark = (key: string, ok: boolean) => setLoaded(old => ({ ...old, [key]: ok }));
  const ready = Object.keys(loaded).length; const failed = Object.values(loaded).filter(ok => !ok).length;
  const pages: AlbumItem[][] = [];
  for (let start = 0; start < photos.length;) { const remaining = photos.length - start; const count = remaining === 5 ? 3 : Math.min(4, remaining); pages.push(photos.slice(start, start + count)); start += count; }
  const totalImages = photos.length + (cover ? 1 : 0);
  return <div className="photo-book">
    <style>{`
      .book-tools { padding:24px 20px; display:flex; gap:12px; flex-wrap:wrap; }
      .book-page { background:#fff; color:#171B18; margin:16px auto; padding:24px; box-sizing:border-box; }
      .book-cover { text-align:center; display:flex; flex-direction:column; justify-content:center; gap:24px; }
      .book-cover img { width:100%; max-height:62vh; object-fit:contain; }
      .book-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px; }
      .book-photo { margin:0; min-width:0; break-inside:avoid; }
      .book-photo img { width:100%; height:180px; object-fit:contain; }
      .book-photo figcaption { font-size:11px; overflow-wrap:anywhere; }
      .book-page h1 { font-size:42px; } .book-page h2 { margin-bottom:16px; }
      @page { size:A4 portrait; margin:12mm; }
      @media print {
        html,body { background:#fff !important; color:#171B18 !important; }
        body main { max-width:none !important; width:auto !important; min-height:0 !important; padding:0 !important; margin:0 !important; }
        body nav,.book-tools,.book-options { display:none !important; }
        .photo-book { width:186mm; margin:0; }
        .book-page { width:186mm; height:272mm; margin:0; padding:0; break-after:page; overflow:hidden; }
        .book-page:last-child { break-after:auto; }
        .book-cover img { max-height:190mm; }
        .book-sheet { display:grid; grid-template-rows:10mm 1fr 8mm; }
        .book-grid { height:248mm; grid-template-rows:repeat(2,minmax(0,1fr)); gap:6mm; }
        .book-photo img { height:94mm; }
        .book-photo figcaption { font-size:9pt; line-height:1.4; }
        .book-photo figcaption p:first-child { max-height:17mm; overflow:hidden; }
        .book-page { print-color-adjust:exact; -webkit-print-color-adjust:exact; }
      }
    `}</style>
    <div className="book-tools"><Link className="btn btn-ghost" href="/memorias">Voltar</Link><button className="btn btn-primary" disabled={ready < totalImages || failed > 0} onClick={() => window.print()}>Imprimir ou salvar em PDF</button>
      <p className="w-full text-sm text-marfim-2">{failed ? `${failed} fotos não carregaram. Recarregue a página antes de imprimir.` : ready < totalImages ? 'Carregando as fotos em alta para impressão...' : 'Escolha papel A4. Você também pode salvar como PDF na janela de impressão.'}</p>
      {failed > 0 && <button className="btn btn-ghost" onClick={() => window.location.reload()}>Recarregar fotos</button>}
    </div>
    <section className="book-page book-cover"><p className="kicker">Nosso livro de fotos</p><h1 className="display">Natal em família<br />{ano}</h1>{cover && <img src={cover} alt={`Capa do Natal de ${ano}`} onLoad={() => mark('cover', true)} onError={() => mark('cover', false)} />}<p>{photos.length} momentos para guardar</p></section>
    {!photos.length && <p className="book-page">Ainda não há fotos nesta edição.</p>}
    {pages.map((page, index) => <section key={index} className="book-page book-sheet"><h2 className="display">Natal de {ano}</h2><div className="book-grid">{page.map(photo => <figure key={photo.key} className="book-photo"><img src={photo.url} alt={photo.caption || `Foto de ${photo.author_name}`} onLoad={() => mark(photo.key, true)} onError={() => mark(photo.key, false)} /><figcaption><p>{photo.caption}</p><p>{photo.author_name}</p></figcaption><button className="book-options btn btn-quiet" onClick={() => setSelected(photo)}>Opções e denúncia</button></figure>)}</div><p>{index + 1} / {pages.length}</p></section>)}
    {selected && <PhotoDialog photo={{ ...selected, can_edit: false }} people={[]} onClose={() => setSelected(null)} onUpdate={() => setSelected(null)} onDelete={() => setSelected(null)} onNavigate={() => {}} />}
  </div>;
}
