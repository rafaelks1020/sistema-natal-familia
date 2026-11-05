'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import SelosPerfil from './_selos';
import BlockedPeople from '../_components/BlockedPeople';
import Link from 'next/link';
import LetraMaior from '@/app/ui/LetraMaior';
import { Camera, ChevronLeft, ExternalLink, LogOut, LockKeyhole } from 'lucide-react';
import Avatar from '@/app/ui/Avatar';
import LoopMedia from '@/app/ui/LoopMedia';
import { api, uploadImage } from '@/app/ui/client';
import { useMe } from '@/app/ui/user';
import { useToast } from '@/app/ui/toast';
import { Empty, Loading, Sheet, type Profile } from '../_components/shared';

type Post = { id: number; images: string[]; content: string; created_at: string };
export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const router = useRouter();
  const toast = useToast();
  const [loaded, setLoaded] = useState<{ id: string; profile: Profile | null; posts: Post[] } | null>(null);
  const [tab, setTab] = useState<'posts' | 'wishlist'>('posts');
  const [sheet, setSheet] = useState<'edit' | 'password' | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', bio: '', avatar_url: '' });
  const [password, setPassword] = useState({ current: '', next: '' });
  const own = Number(id) === me.id;
  const profile = loaded?.id === id ? loaded.profile : null;
  const posts = loaded?.id === id ? loaded.posts : [];
  useEffect(() => {
    let active = true;
    async function load() {
      const [person, publications] = await Promise.allSettled([
        api<Profile>(`/api/family/${id}`),
        api<Post[] | { posts: Post[] }>(`/api/posts?user_id=${encodeURIComponent(id)}`),
      ]);
      if (!active) return;
      if (person.status === 'rejected') {
        toast((person.reason as Error).message, 'erro');
        setLoaded({ id, profile: null, posts: [] });
        return;
      }
      let posts: Post[] = [];
      if (publications.status === 'fulfilled') {
        const data = publications.value;
        posts = Array.isArray(data) ? data : data.posts ?? [];
      } else toast((publications.reason as Error).message, 'erro');
      setLoaded({ id, profile: person.value, posts });
    }
    void load();
    return () => { active = false; };
  }, [id, toast]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (sheet === 'edit') {
        const updated = await api<Profile>('/api/me', { method: 'PUT', json: form });
        setLoaded((current) => current?.profile ? { ...current, profile: { ...current.profile, ...updated } } : current);
        router.refresh();
        toast('Perfil atualizado.');
      } else {
        await api('/api/me/password', { method: 'POST', json: password });
        toast('Senha alterada.');
        setPassword({ current: '', next: '' });
      }
      setSheet(null);
    } catch (error) { toast((error as Error).message, 'erro'); }
    finally { setBusy(false); }
  }
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    try { const avatar_url = await uploadImage(file); setForm((current) => ({ ...current, avatar_url })); }
    catch (error) { toast((error as Error).message, 'erro'); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true);
    try { await api('/api/auth', { method: 'DELETE' }); window.location.href = '/entrar'; }
    catch (error) { toast((error as Error).message, 'erro'); setBusy(false); }
  }
  return <main className="mx-auto max-w-xl"><header className="flex items-center justify-between px-5 py-4"><Link href="/familia" aria-label="Voltar para a família" className="flex h-11 w-11 items-center"><ChevronLeft size={24} strokeWidth={1.5} /></Link><h1 className="display text-2xl">Perfil</h1><span className="w-11" /></header>
    {loaded?.id !== id ? <Loading /> : !profile ? <Empty title="Perfil indisponível" text="Volte à família e escolha outro perfil." /> : <>
      <div className="relative h-36 overflow-hidden"><LoopMedia name="mn-hero" className="h-full w-full object-cover opacity-65" fallback={<div className="absolute inset-0 bg-carvao-2" style={{ backgroundImage: 'radial-gradient(circle at 80% 30%, #BFA57766 0, transparent 14%), radial-gradient(circle at 30% 60%, #BFA57744 0, transparent 24%), radial-gradient(circle at 60% 10%, #BFA57755 0, transparent 18%)' }} />} /><div className="absolute inset-0 bg-gradient-to-t from-carvao to-transparent" /></div>
      <section className="rise relative -mt-14 px-5 text-center"><Avatar name={profile.name} src={profile.avatar_url} size={112} ring className="mx-auto" /><h2 className="display mt-5 break-words text-[2.5rem]">{profile.name}</h2>{profile.is_admin && <p className="kicker mt-2">organiza o nosso Natal</p>}{profile.bio && <p className="mx-auto mt-3 max-w-xs whitespace-pre-wrap break-words text-sm leading-relaxed text-marfim-2">{profile.bio}</p>}
      <div className="my-7 grid grid-cols-3 divide-x divide-linha">{[[profile.posts_count, 'posts'], [profile.reactions_received, 'curtidas'], [profile.comments_count, 'comentários']].map(([value, label]) => <div key={label}><p className="numeral text-3xl">{value}</p><p className="mt-1 text-xs text-marfim-2">{label}</p></div>)}</div>
      <SelosPerfil id={id} />
      {own && <div className="mb-7"><button className="btn btn-ghost w-full" onClick={() => { setForm({ name: profile.name, bio: profile.bio ?? '', avatar_url: profile.avatar_url ?? '' }); setSheet('edit'); }}>Editar perfil</button><div className="mt-2 flex justify-center gap-4"><button className="btn btn-quiet text-xs" disabled={busy} onClick={() => setSheet('password')}><LockKeyhole size={15} strokeWidth={1.5} />Trocar senha</button><button className="btn btn-quiet text-xs" disabled={busy} onClick={logout}><LogOut size={15} strokeWidth={1.5} />Sair</button><LetraMaior /></div><div className="mt-3 flex justify-center gap-5 text-xs text-marfim-3"><Link href="/termos" className="underline underline-offset-4">Termos de uso</Link><Link href="/privacidade" className="underline underline-offset-4">Privacidade</Link><Link href="/conta/excluir" className="underline underline-offset-4">Excluir minha conta</Link></div></div>}
        {own && <BlockedPeople />}
      </section>
      <div role="tablist" aria-label="Conteúdo do perfil" className="mx-5 flex border-b border-linha">{(['posts', 'wishlist'] as const).map((key) => <button key={key} role="tab" id={`tab-${key}`} aria-selected={tab === key} aria-controls={`panel-${key}`} onClick={() => setTab(key)} className={`relative min-h-14 flex-1 text-sm ${tab === key ? 'text-marfim after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-cereja' : 'text-marfim-3'}`}>{key === 'posts' ? 'Posts' : 'Lista de desejos'}</button>)}</div>
      <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="px-5 py-5">{tab === 'posts' ? posts.some((post) => post.images?.length) ? <div className="grid grid-cols-3 gap-2">{posts.filter((post) => post.images?.length).map((post) => <Link key={post.id} href={`/mural?post=${post.id}`} className="aspect-square overflow-hidden rounded-[14px] bg-carvao-2" aria-label={post.content || 'Ver publicação'}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={post.images[0]} alt={post.content || 'Foto da família'} className="h-full w-full object-cover" loading="lazy" /></Link>)}</div> : <Empty title="Memórias por chegar" text="As fotos publicadas no mural aparecerão aqui." /> : profile.wishlist.length ? <div>{profile.wishlist.map((wish) => <article key={wish.id} className="border-b border-linha py-5 first:pt-0"><div className="flex items-start justify-between gap-4"><h3 className="display text-2xl">{wish.item_name}</h3>{wish.purchased && <span className="text-xs text-salvia">Já escolhido</span>}</div>{wish.item_description && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-marfim-3">{wish.item_description}</p>}{wish.item_url && /^https?:\/\//i.test(wish.item_url) && <a href={wish.item_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-2 text-xs text-champagne">Ver ideia de presente<ExternalLink size={14} strokeWidth={1.5} /></a>}</article>)}</div> : <Empty title="Um desejo ainda em segredo" text="Quando houver uma lista para o amigo oculto atual, ela aparecerá aqui." />}</section>
    </>}
    {sheet && <Sheet title={sheet === 'edit' ? 'Seu perfil' : 'Trocar senha'} onClose={() => setSheet(null)} busy={busy}><form onSubmit={save} className="space-y-5">{sheet === 'edit' ? <><div className="flex items-center gap-5"><Avatar name={form.name || me.name} src={form.avatar_url} size={72} ring /><label className={`btn btn-ghost ${busy ? 'pointer-events-none opacity-50' : ''}`}><Camera size={18} strokeWidth={1.5} />{busy ? 'Enviando foto…' : 'Escolher foto'}<input className="sr-only" type="file" accept="image/*" disabled={busy} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ''; }} /></label></div><label className="block text-sm text-marfim-2">Como a família te chama<input className="field mt-2" required maxLength={120} autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="block text-sm text-marfim-2">Um pouco sobre você<textarea className="field mt-2 min-h-24 resize-none" maxLength={160} value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} /><span className="mt-1 block text-right text-xs text-marfim-3">{form.bio.length}/160</span></label></> : <><label className="block text-sm text-marfim-2">Senha atual<input className="field mt-2" type="password" autoComplete="current-password" required maxLength={1024} value={password.current} onChange={(event) => setPassword({ ...password, current: event.target.value })} /></label><label className="block text-sm text-marfim-2">Nova senha<input className="field mt-2" type="password" autoComplete="new-password" required minLength={6} maxLength={1024} value={password.next} onChange={(event) => setPassword({ ...password, next: event.target.value })} /><span className="mt-2 block text-xs text-marfim-3">Pelo menos 6 caracteres.</span></label></>}<button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Um instante…' : 'Salvar alterações'}</button></form></Sheet>}
  </main>;
}
