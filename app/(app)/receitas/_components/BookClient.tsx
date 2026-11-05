'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Entry as Recipe } from '@/app/api/receitas/_data';
import type { Entry as Story } from '@/app/api/historias/_data';
import PageHeader from '@/app/ui/PageHeader';
import Avatar from '@/app/ui/Avatar';
import { api, thumb, uploadImage } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { useMe } from '@/app/ui/user';
import ModerationActions from '../../mural/_components/ModerationActions';
import { AudioField, AudioPlayer } from './Audio';

type Kind = 'receitas' | 'historias';
type Entry = Recipe | Story;
type Draft = { titulo: string; de_quem: string; quem_conta: string; categoria: string; epoca: string; foto_url: string; ingredientes: string; modo_preparo: string; segredo: string; audio_url: string; transcricao: string; duracao_s: number };
const empty: Draft = { titulo: '', de_quem: '', quem_conta: '', categoria: 'Pratos principais', epoca: '', foto_url: '', ingredientes: '', modo_preparo: '', segredo: '', audio_url: '', transcricao: '', duracao_s: 0 };
function draftFrom(item?: Entry): Draft { return item ? { ...empty, ...item, foto_url: item.foto_url ?? '', audio_url: item.audio_url ?? '', segredo: 'segredo' in item ? item.segredo ?? '' : '', transcricao: 'transcricao' in item ? item.transcricao ?? '' : '' } : { ...empty }; }
const categories = ['Pratos principais', 'Acompanhamentos', 'Sobremesas', 'Bebidas', 'Outras'];

export default function BookClient({ kind, items, ano, detail = false }: { kind: Kind; items: Entry[]; ano: number; detail?: boolean }) {
  const me = useMe(); const router = useRouter(); const toast = useToast();
  const recipe = kind === 'receitas';
  const [search, setSearch] = useState(''); const [category, setCategory] = useState('');
  const [editing, setEditing] = useState<number | null | undefined>();
  const [draft, setDraft] = useState<Draft>({ ...empty });
  const [busy, setBusy] = useState(false); const [audioBusy, setAudioBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const visible = items.filter(item => `${item.titulo} ${'de_quem' in item ? item.de_quem : item.quem_conta}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')) && (!category || ('categoria' in item && item.categoria === category)));
  function open(item?: Entry) { setDraft(draftFrom(item)); setEditing(item?.id ?? null); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function field(key: keyof Draft, value: string | number) { setDraft(d => ({ ...d, [key]: value })); }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || audioBusy || photoBusy) return;
    if (!recipe && !draft.audio_url) { toast('Grave ou envie o áudio da história.', 'erro'); return; }
    setBusy(true);
    try {
      await api(`/api/${kind}${editing ? `/${editing}` : ''}`, { method: editing ? 'PATCH' : 'POST', json: draft });
      setEditing(undefined); toast('Guardado no livro da família.'); router.refresh();
    } catch (error) { toast((error as Error).message, 'erro'); }
    finally { setBusy(false); }
  }
  async function remove(id: number) {
    if (busy) return; setBusy(true);
    try { await api(`/api/${kind}/${id}`, { method: 'DELETE' }); setDeleting(null); toast('Conteúdo apagado.'); if (detail) router.push(`/${kind}`); router.refresh(); }
    catch (error) { toast((error as Error).message, 'erro'); } finally { setBusy(false); }
  }
  return <main className="mx-auto w-full min-w-0 max-w-3xl pb-28">
    <PageHeader kicker={`Memórias da família · Natal ${ano}`} title={recipe ? 'Livro de receitas' : 'Histórias em áudio'} back={detail ? `/${kind}` : '/'} />
    <div className="space-y-6 px-5">
      <p className="text-marfim-2">{recipe ? 'O sabor que atravessa gerações. Guarde a receita e o segredo de quem faz.' : 'Como era o Natal antigamente? Sente com quem viveu e guarde essa voz para a família.'}</p>
      {!detail ? <>
        <button className="btn btn-primary w-full" type="button" disabled={busy || audioBusy || photoBusy} onClick={() => open()}>{recipe ? 'Guardar uma receita' : 'Contar uma história'}</button>
        <label className="block text-sm">Buscar {recipe ? 'receita ou pessoa' : 'história ou pessoa'}<input className="field mt-2 w-full" type="search" value={search} onChange={e => setSearch(e.target.value)} /></label>
        {recipe ? <label className="block text-sm">Categoria<select className="field mt-2 min-h-11 w-full" value={category} onChange={e => setCategory(e.target.value)}><option value="">Todas as categorias</option>{Array.from(new Set([...categories, ...items.flatMap(item => 'categoria' in item ? [item.categoria] : [])])).map(c => <option key={c}>{c}</option>)}</select></label> : null}
      </> : null}
      {editing !== undefined ? <section className="rounded-2xl border border-champagne/25 bg-carvao-2 p-4">
        <h2 className="display mb-5 text-2xl">{editing ? 'Editar' : 'Nova'} {recipe ? 'receita' : 'história'}</h2>
        <form onSubmit={event => void save(event)} className="space-y-4">
          <label className="block text-sm">{recipe ? 'Nome da receita' : 'Título da história'}<input autoFocus className="field mt-2 w-full" required maxLength={160} value={draft.titulo} onChange={e => field('titulo', e.target.value)} /></label>
          <label className="block text-sm">{recipe ? 'De quem é? Ex.: Vó Maria' : 'Quem conta?'}<input className="field mt-2 w-full" required maxLength={100} value={recipe ? draft.de_quem : draft.quem_conta} onChange={e => field(recipe ? 'de_quem' : 'quem_conta', e.target.value)} /></label>
          {recipe ? <><label className="block text-sm">Categoria<input className="field mt-2 w-full" list="recipe-categories" required maxLength={60} value={draft.categoria} onChange={e => field('categoria', e.target.value)} /><datalist id="recipe-categories">{categories.map(c => <option key={c} value={c} />)}</datalist></label>
            {(['ingredientes', 'modo_preparo', 'segredo'] as const).map(key => <label className="block text-sm" key={key}>{key === 'ingredientes' ? 'Ingredientes' : key === 'modo_preparo' ? 'Modo de preparo' : 'O segredo (opcional)'}<textarea className="field mt-2 min-h-28 w-full" required={key !== 'segredo'} maxLength={key === 'segredo' ? 4000 : key === 'ingredientes' ? 12000 : 16000} value={draft[key]} onChange={e => field(key, e.target.value)} /></label>)}</> : <><label className="block text-sm">Época. Ex.: Natal de 1985<input className="field mt-2 w-full" required maxLength={100} value={draft.epoca} onChange={e => field('epoca', e.target.value)} /></label><label className="block text-sm">Transcrição ou lembrança por escrito (opcional)<textarea className="field mt-2 min-h-28 w-full" maxLength={30000} value={draft.transcricao} onChange={e => field('transcricao', e.target.value)} /></label></>}
          <label className="block text-sm">Foto (opcional)<input className="field mt-2 min-h-11 w-full min-w-0" type="file" accept="image/*" disabled={photoBusy || busy} onChange={async e => {
            const file = e.target.files?.[0]; if (!file) return; setPhotoBusy(true);
            try { field('foto_url', await uploadImage(file)); } catch (error) { toast((error as Error).message, 'erro'); } finally { setPhotoBusy(false); }
          }} /></label>
          {photoBusy ? <p role="status">Enviando foto...</p> : null}
          {draft.foto_url ? <div>
            {/* A foto já usa o otimizador por thumb(). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="h-40 w-full rounded-xl object-cover" src={thumb(draft.foto_url, 640)} alt="Foto escolhida" /><button type="button" className="btn btn-quiet w-full" onClick={() => field('foto_url', '')}>Remover foto</button></div> : null}
          <AudioField key={editing ?? 'new'} value={draft.audio_url} onChange={(url, seconds) => setDraft(d => ({ ...d, audio_url: url, duracao_s: seconds }))} onBusy={setAudioBusy} />
          <button className="btn btn-primary w-full" disabled={busy || audioBusy || photoBusy}>{busy ? 'Salvando...' : recipe ? 'Salvar receita' : 'Salvar história'}</button>
          <button type="button" className="btn btn-quiet w-full" disabled={busy || audioBusy || photoBusy} onClick={() => setEditing(undefined)}>Cancelar</button>
        </form>
      </section> : null}
      {!visible.length ? <div className="rounded-2xl border border-champagne/20 p-6"><h2 className="display text-2xl">{search || category ? 'Nenhum resultado' : 'As memórias começam aqui'}</h2><p className="mt-3 text-marfim-2">{search || category ? 'Experimente outro nome ou categoria.' : recipe ? 'Seja a primeira pessoa a guardar uma receita da família.' : 'Que tal perguntar qual foi o Natal mais marcante?'}</p></div> : visible.map(item => <article key={item.id} className="min-w-0 space-y-4 overflow-hidden rounded-2xl border border-champagne/20 bg-carvao-2 p-5">
        {item.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb(item.foto_url, 828)} alt={item.titulo} loading="lazy" className="aspect-[4/3] w-full rounded-xl object-cover" />) : null}
        <p className="kicker">{'categoria' in item ? item.categoria : item.epoca}</p>
        <h2 className="display break-words text-3xl">{detail ? item.titulo : <Link className="inline-flex min-h-11 items-center" href={`/${kind}/${item.id}`}>{item.titulo}</Link>}</h2>
        <p className="text-champagne">{'de_quem' in item ? `Da cozinha de ${item.de_quem}` : `Na voz de ${item.quem_conta}`}</p>
        {item.audio_url ? <AudioPlayer key={item.audio_url} url={item.audio_url} /> : null}
        {detail && 'ingredientes' in item ? <>
          <section><h3 className="kicker mb-3">Ingredientes</h3><p className="whitespace-pre-wrap break-words text-marfim-2">{item.ingredientes}</p></section>
          <div className="rule" /><section><h3 className="kicker mb-3">Modo de preparo</h3><p className="whitespace-pre-wrap break-words text-marfim-2">{item.modo_preparo}</p></section>
          {item.segredo ? <aside className="rounded-xl border border-champagne/40 bg-champagne/10 p-5"><h3 className="display mb-3 text-2xl text-champagne">O segredo</h3><p className="whitespace-pre-wrap break-words">{item.segredo}</p></aside> : null}
        </> : null}
        {detail && 'transcricao' in item && item.transcricao ? <section><h3 className="kicker mb-3">A lembrança por escrito</h3><p className="whitespace-pre-wrap break-words text-marfim-2">{item.transcricao}</p></section> : null}
        <div className="flex items-center gap-3"><Avatar name={item.author_name} src={item.avatar_url} size={32} /><p className="min-w-0 break-words text-sm text-marfim-3">Guardado por {item.author_name}</p></div>
        {(me.id === item.user_id || me.is_admin) ? <div className="flex flex-wrap gap-2"><button type="button" className="btn btn-ghost min-h-11" disabled={busy || audioBusy || photoBusy} onClick={() => open(item)}>Editar</button><button type="button" className="btn btn-quiet min-h-11" disabled={busy || audioBusy || photoBusy} onClick={() => setDeleting(item.id)}>Apagar</button></div> : null}
        {deleting === item.id ? <div role="alert" className="space-y-3"><p>Apagar esta {recipe ? 'receita' : 'história'} da família?</p><button className="btn btn-primary w-full" disabled={busy} onClick={() => void remove(item.id)}>Confirmar exclusão</button><button className="btn btn-quiet w-full" disabled={busy} onClick={() => setDeleting(null)}>Manter</button></div> : null}
        {me.id !== item.user_id ? <ModerationActions userId={item.user_id} name={item.author_name} alvoTipo={recipe ? 'receita' : 'historia'} alvoId={item.id} /> : null}
      </article>)}
    </div>
  </main>;
}
