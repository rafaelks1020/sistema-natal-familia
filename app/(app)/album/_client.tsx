'use client';
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { AlbumItem, AlbumMetadata, AlbumPerson, AlbumResponse } from '@/app/api/album/types';
import Avatar from '@/app/ui/Avatar';
import LoopMedia from '@/app/ui/LoopMedia';
import { useMe } from '@/app/ui/user';
import PageHeader from '@/app/ui/PageHeader';
import { api, thumb, uploadImage } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import ModerationActions from '../mural/_components/ModerationActions';

export function PeoplePicker({ people, selected, onChange }: { people: AlbumPerson[]; selected: string[]; onChange: (keys: string[]) => void }) {
  const [search, setSearch] = useState('');
  return <fieldset className="space-y-2"><legend className="text-sm text-marfim-2">Quem está nas fotos?</legend>
    <input className="field" aria-label="Buscar pessoa da família" placeholder="Buscar pessoa" value={search} onChange={e => setSearch(e.target.value)} />
    <div className="max-h-48 overflow-y-auto">{people.filter(p => p.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))).map(p => {
      const key = `${p.source}:${p.id}`;
      return <label key={key} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={selected.includes(key)} onChange={e => onChange(e.target.checked ? [...selected, key] : selected.filter(k => k !== key))} />{p.name}</label>;
    })}{!people.length && <p className="text-sm text-marfim-3">Ainda não há pessoas para marcar.</p>}</div>
  </fieldset>;
}

export default function AlbumClient({ initial, metadata, ano, pessoa }: { initial: AlbumResponse; metadata: AlbumMetadata; ano: number; pessoa: string }) {
  const toast = useToast(); const router = useRouter(); const uploadKeys = useRef(new WeakMap<File, string>());
  const [items, setItems] = useState(initial.items); const [cursor, setCursor] = useState(initial.nextCursor);
  const [source, setSource] = useState<'tudo' | AlbumItem['source']>('tudo');
  const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false); const [files, setFiles] = useState<File[]>([]);
  const [year, setYear] = useState(metadata.currentYear); const [date, setDate] = useState(`${metadata.currentYear}-12-24`);
  const [caption, setCaption] = useState(''); const [people, setPeople] = useState<string[]>([]);
  const [progress, setProgress] = useState(0); const [selected, setSelected] = useState<string | null>(null);
  async function more() {
    if (busy || !cursor) return; setBusy(true);
    try { const next = await api<AlbumResponse>(`/api/album?ano=${ano}&pessoa=${encodeURIComponent(pessoa)}&cursor=${encodeURIComponent(cursor)}`);
      setItems(old => [...new Map([...old, ...next.items].map(p => [p.key, p])).values()]); setCursor(next.nextCursor);
    } catch (e) { toast((e as Error).message, 'erro'); } finally { setBusy(false); }
  }
  async function refreshPhotos() {
    try { const next = await api<AlbumResponse>(`/api/album?ano=${ano}&pessoa=${encodeURIComponent(pessoa)}`); setItems(next.items); setCursor(next.nextCursor); }
    catch (e) { toast(`As fotos foram salvas. ${(e as Error).message}`, 'erro'); }
  }
  async function upload() {
    if (uploading || !files.length) return; setUploading(true); setProgress(0);
    let saved = 0;
    try {
      for (const file of files) {
        let clientKey = uploadKeys.current.get(file);
        if (!clientKey) { clientKey = crypto.randomUUID(); uploadKeys.current.set(file, clientKey); }
        const url = await uploadImage(file);
        await api('/api/album', { method: 'POST', json: { ano: year, taken_on: date, caption, people,
          photos: [{ url, client_key: clientKey }] } });
        saved++; setProgress(saved);
      }
      if (year === ano) await refreshPhotos();
      toast(`${saved} fotos guardadas no álbum de ${year}.`); setShowUpload(false); setFiles([]);
      router.push(`/album?ano=${year}`); router.refresh();
    } catch (e) { setFiles(old => old.slice(saved)); toast(`${saved} fotos salvas. ${(e as Error).message} Você pode enviar as restantes.`, 'erro'); if (year === ano && saved > 0) await refreshPhotos(); router.refresh(); }
    finally { setUploading(false); }
  }
  const visible = items.filter(p => source === 'tudo' || p.source === source);
  const photo = visible.find(p => p.key === selected);
  return <div className="pb-28"><PageHeader kicker="Memórias que ficam" title="Álbum da família" back="/familia" action={<Link className="btn btn-quiet" href="/memorias">Memórias</Link>} />
    <div className="space-y-5 px-5">
      <nav aria-label="Edição do álbum" className="flex gap-2 overflow-x-auto">{[...new Set([ano, ...metadata.years])].sort((a, b) => b - a).map(y => <Link key={y} className={`btn shrink-0 ${y === ano ? 'btn-primary' : 'btn-ghost'}`} aria-current={y === ano ? 'page' : undefined} href={`/album?ano=${y}${pessoa ? `&pessoa=${encodeURIComponent(pessoa)}` : ''}`}>{y}</Link>)}</nav>
      <label className="block text-sm text-marfim-2">Fotos de uma pessoa<select className="field mt-2" value={pessoa} onChange={e => router.push(`/album?ano=${ano}&pessoa=${encodeURIComponent(e.target.value)}`)}><option value="">Todas as pessoas</option>{metadata.people.map(p => <option key={`${p.source}:${p.id}`} value={`${p.source}:${p.id}`}>{p.name}</option>)}</select></label>
      <div className="aspect-video overflow-hidden rounded-2xl border border-linha"><LoopMedia name="mn-album" className="h-full w-full" fallback={<div className="flex h-full items-center justify-center gap-3 overflow-hidden bg-carvao-2 p-6">{items.length ? items.slice(0, 3).map((p, i) => <img key={p.key} src={thumb(p.url, 256)} alt="Memória de Natal" className="h-28 min-w-0 flex-1 rounded-lg border border-linha-forte object-cover" style={{ transform: `rotate(${(i - 1) * 6}deg)` }} />) : <p className="display text-2xl text-champagne">Memórias que ficam</p>}</div>} /></div>
      <div className="flex flex-wrap gap-2" aria-label="Origem das fotos">{([{ key: 'tudo', label: 'Tudo' }, { key: 'album', label: 'Álbum' }, { key: 'post', label: 'Mural' }, { key: 'compra', label: 'Compras' }] as const).map(option => <button key={option.key} className={`btn ${source === option.key ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={source === option.key} onClick={() => { setSource(option.key); setSelected(null); }}>{option.label}</button>)}</div>
      <button className="btn btn-primary w-full" onClick={() => setShowUpload(v => !v)}>Adicionar até 30 fotos</button>
      {showUpload && <form className="space-y-4 rounded-2xl border border-linha bg-carvao-2 p-4" onSubmit={e => { e.preventDefault(); void upload(); }}>
        <p className="text-sm text-marfim-2">Guarde as fotos na edição certa. Elas ficam só no álbum, sem aviso para a família.</p>
        <fieldset disabled={uploading} className="space-y-4">
          <label className="block text-sm">Ano da edição<input required className="field mt-2" type="number" min={1900} max={metadata.currentYear} value={year} onChange={e => { const y = Number(e.target.value); setYear(y); setDate(`${y}-12-24`); }} /></label>
          <label className="block text-sm">Data em que as fotos foram tiradas<input required type="date" className="field mt-2" min={`${year}-01-01`} max={`${year}-12-31`} value={date} onChange={e => setDate(e.target.value)} /></label>
          <label className="block text-sm">Legenda (opcional)<textarea className="field mt-2" maxLength={500} value={caption} onChange={e => setCaption(e.target.value)} /></label>
          <PeoplePicker people={metadata.people} selected={people} onChange={setPeople} />
          <label className="block text-sm">Escolher fotos<input className="field mt-2" type="file" accept="image/*" multiple onChange={e => {
            const selected = Array.from(e.target.files ?? []);
            if (selected.length > 30) { toast('Escolha até 30 fotos por vez.', 'erro'); e.target.value = ''; setFiles([]); return; }
            setFiles(selected);
          }} /></label>
        </fieldset>
        {uploading && <div role="status" aria-live="polite"><p>{progress} de {files.length} fotos salvas</p><progress className="w-full" max={files.length} value={progress} /></div>}
        <button className="btn btn-primary w-full" disabled={uploading || !files.length}>{uploading ? 'Guardando fotos...' : `Guardar ${files.length || ''} fotos`}</button>
      </form>}
      <p className="kicker">Natal de {ano} · {visible.length} fotos{cursor ? ' carregadas' : ''}</p>
      {!visible.length && <p className="rounded-2xl bg-carvao-2 p-6 text-marfim-2">Ainda não há fotos neste filtro. Adicione os registros da família.</p>}
      <div className="columns-2 gap-2">{visible.map(item => <button key={item.key} className="relative mb-2 block min-h-11 w-full break-inside-avoid overflow-hidden rounded-xl text-left" onClick={() => setSelected(item.key)} aria-label={`Abrir foto de ${item.author_name}`}>
        <img src={thumb(item.url, 640)} alt={item.caption || 'Foto da família'} loading="lazy" className="h-auto w-full" /><span className="absolute inset-x-0 bottom-0 bg-carvao/80 p-2 text-xs">{item.author_name}</span>
      </button>)}</div>
      {cursor && <button className="btn btn-ghost w-full" disabled={busy} onClick={() => void more()}>{busy ? 'Carregando...' : 'Carregar mais fotos'}</button>}
      {metadata.isAdmin && <AlbumReports onChange={() => { void refreshPhotos(); router.refresh(); }} />}
    </div>
    {photo && <PhotoDialog key={photo.key} photo={photo} people={metadata.people} onClose={() => setSelected(null)}
      onUpdate={updated => { setItems(old => old.map(p => p.key === updated.key ? updated : p)); router.refresh(); }}
      onDelete={() => { setItems(old => old.filter(p => p.key !== photo.key)); setSelected(null); router.refresh(); }}
      previous={visible[visible.indexOf(photo) - 1]?.key} next={visible[visible.indexOf(photo) + 1]?.key} onNavigate={setSelected} />}
  </div>;
}

export function PhotoDialog({ photo, people, onClose, onUpdate, onDelete, previous, next, onNavigate }: {
  photo: AlbumItem; people: AlbumPerson[]; onClose: () => void; onUpdate: (p: AlbumItem) => void; onDelete: () => void;
  previous?: string; next?: string; onNavigate: (key: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null); const toast = useToast(); const me = useMe();
  const [tags, setTags] = useState(photo.tags.map(p => `${p.source}:${p.id}`));
  const [edit, setEdit] = useState(false); const [report, setReport] = useState(false); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);
  async function action(run: () => Promise<unknown>, done?: () => void) {
    if (busy) return; setBusy(true);
    try { await run(); done?.(); } catch (e) { toast((e as Error).message, 'erro'); } finally { setBusy(false); }
  }
  return <dialog ref={ref} onCancel={onClose} onClose={onClose} aria-label="Foto do álbum" className="fixed inset-0 m-auto max-h-dvh w-full max-w-3xl overflow-y-auto border border-linha bg-carvao p-4 text-marfim backdrop:bg-black/90">
    <div className="mb-3 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><Avatar name={photo.author_name} src={photo.author_avatar} size={36} /><p className="min-w-0 truncate text-sm">{photo.author_name} · {photo.ano}</p></div><button className="btn btn-quiet" onClick={onClose}>Fechar</button></div>
    <img src={thumb(photo.url, 1280, 85)} alt={photo.caption || 'Foto da família'} className="mx-auto max-h-[60dvh] w-full object-contain" />
    <p className="mt-3 whitespace-pre-wrap break-words">{photo.caption}</p><p className="my-2 text-sm text-marfim-2">{photo.tags.map(p => p.name).join(', ') || 'Sem pessoas marcadas'}</p>
    <div className="flex flex-wrap gap-2"><button className="btn btn-ghost" disabled={!previous} onClick={() => previous && onNavigate(previous)}>Anterior</button><button className="btn btn-ghost" disabled={!next} onClick={() => next && onNavigate(next)}>Próxima</button><a className="btn btn-ghost" href={photo.url} target="_blank" rel="noreferrer" download>Baixar foto</a></div>
    {photo.source === 'post' && <><Link className="btn btn-quiet" href={`/mural?post=${photo.post_id}`}>Ver no mural</Link>{photo.user_id && photo.user_id !== me.id && <ModerationActions userId={photo.user_id} name={photo.author_name} postId={photo.post_id} />}</>}
    {photo.source === 'album' && <div className="mt-3 space-y-2">
      <button className="btn btn-ghost" disabled={busy} onClick={() => void action(() => api('/api/album/likes', { method: 'PUT', json: { key: photo.key, liked: !photo.liked } }), () => onUpdate({ ...photo, liked: !photo.liked, likes: photo.likes + (photo.liked ? -1 : 1) }))}>{photo.liked ? 'Descurtir' : 'Curtir'} · {photo.likes}</button>
      {photo.user_id !== me.id && <>      <button className="btn btn-quiet" onClick={() => setReport(v => !v)}>Denunciar foto</button>
      <button className="btn btn-quiet" disabled={busy} onClick={() => { if (window.confirm(`Bloquear ${photo.author_name}? Você deixará de ver os registros dessa pessoa.`)) void action(() => api('/api/blocks', { method: 'POST', json: { user_id: photo.user_id } }), () => window.location.reload()); }}>Bloquear {photo.author_name}</button>
      {report && <form className="space-y-2" onSubmit={e => { e.preventDefault(); void action(() => api('/api/album/reports', { method: 'POST', json: { key: photo.key, motivo: reason } }), () => { toast('Denúncia enviada. Quem organiza vai analisar.'); setReport(false); }); }}><label>Motivo<textarea required maxLength={1000} className="field mt-2" value={reason} onChange={e => setReason(e.target.value)} /></label><button disabled={busy} className="btn btn-primary">Enviar denúncia</button></form>}</>}
      {photo.can_edit && <button className="btn btn-quiet" disabled={busy} onClick={() => { if (window.confirm('Apagar esta foto do álbum?')) void action(() => api('/api/album', { method: 'DELETE', json: { key: photo.key } }), onDelete); }}>Apagar foto</button>}
    </div>}
    {photo.can_edit && <div className="mt-4 space-y-3"><button className="btn btn-ghost" onClick={() => setEdit(v => !v)}>Marcar pessoas</button>{edit && <><PeoplePicker people={people} selected={tags} onChange={setTags} /><button className="btn btn-primary" disabled={busy} onClick={() => void action(() => api('/api/album/tags', { method: 'PUT', json: { key: photo.key, people: tags } }), () => { onUpdate({ ...photo, tags: people.filter(p => tags.includes(`${p.source}:${p.id}`)) }); setEdit(false); })}>Salvar marcações</button></>}</div>}
  </dialog>;
}

interface Report { id: number; key: string; motivo: string; author_name: string; image_url: string }
function AlbumReports({ onChange }: { onChange: () => void }) {
  const [reports, setReports] = useState<Report[] | null>(null); const [busy, setBusy] = useState(false); const toast = useToast();
  async function load() { setBusy(true); try { setReports((await api<{ reports: Report[] }>('/api/album/reports')).reports); } catch (e) { toast((e as Error).message, 'erro'); } finally { setBusy(false); } }
  async function resolve(report: Report, remove: boolean) {
    if (busy) return; setBusy(true);
    try { if (remove) await api('/api/album', { method: 'DELETE', json: { key: report.key } }); else await api('/api/album/reports', { method: 'PATCH', json: { id: report.id } });
      await load(); onChange();
    } catch (e) { toast((e as Error).message, 'erro'); } finally { setBusy(false); }
  }
  return <section className="space-y-3 border-t border-linha pt-4"><button className="btn btn-ghost" disabled={busy} onClick={() => void load()}>Analisar denúncias do álbum</button>{reports?.length === 0 && <p>Nenhuma denúncia pendente.</p>}{reports?.map(report => <article key={report.id} className="space-y-2 rounded-xl bg-carvao-2 p-4"><img src={thumb(report.image_url, 384)} alt={`Foto denunciada de ${report.author_name}`} className="max-h-48 w-full object-contain" /><p className="break-words">{report.author_name}: {report.motivo}</p><div className="flex flex-wrap gap-2"><button className="btn btn-ghost" disabled={busy} onClick={() => void resolve(report, false)}>Encerrar análise</button><button className="btn btn-primary" disabled={busy} onClick={() => { if (window.confirm('Apagar esta foto denunciada?')) void resolve(report, true); }}>Apagar foto</button></div></article>)}</section>;
}
