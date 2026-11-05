'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { Flame } from 'lucide-react';
import { api, uploadImage } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import Avatar from '@/app/ui/Avatar';
import PageHeader from '@/app/ui/PageHeader';
import { thumb } from '@/app/ui/thumb';
import ModerationActions from '../mural/_components/ModerationActions';
import type { HomenagemDados, Memorial } from '@/app/api/homenagem/_data';

export default function HomenagemClient({ initial }: { initial: HomenagemDados }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);
  const lock = useRef(false);
  const toast = useToast();

  async function protegido(trabalho: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await trabalho();
      try {
        setData(await api<HomenagemDados>('/api/homenagem'));
        toast('Pronto, atualizado.');
      } catch {
        toast('Salvo. Recarregue a página para atualizar.', 'erro');
      }
    } catch (e) {
      toast((e as Error).message, 'erro');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return <>
    <PageHeader title="Homenagens" kicker="Natal em Família" back="/" />
    <div className="space-y-7 px-5 pb-12">
      <p className="text-sm leading-relaxed text-marfim-2">Um lugar quieto para lembrar de quem a gente ama.</p>
      <details className="surface p-5">
        <summary className="min-h-11 cursor-pointer py-3 text-champagne">Criar uma homenagem</summary>
        <FormMemorial pessoas={data.pessoas} busy={busy} onSubmit={(form) => protegido(async () => { await api('/api/homenagem', { method: 'POST', json: await jsonMemorial(form) }); form.reset(); })} />
      </details>
      {!data.memoriais.length ? <p className="py-6 text-sm text-marfim-3">Ainda não há homenagens. Quando a família quiser lembrar de alguém, o espaço está aqui.</p> : null}
      {data.memoriais.map((item) => <article key={item.id} className="surface min-w-0 space-y-4 break-words p-5">
        <MemorialCorpo item={item} />
        <p className="text-sm text-champagne">{item.velas === 1 ? '1 vela acesa' : `${item.velas} velas acesas`}</p>
        <button type="button" className="btn btn-ghost min-h-11 w-full" disabled={busy || item.acendi} onClick={() => { void protegido(() => api(`/api/homenagem/${item.id}/vela`, { method: 'POST' })); }}>
          <Flame size={16} strokeWidth={1.5} /> {item.acendi ? 'Você acendeu uma vela nesta edição' : 'Acender uma vela'}
        </button>
        {item.pode_editar && editando === item.id ? <FormMemorial pessoas={data.pessoas} busy={busy} memorial={item} cancelar={() => setEditando(null)} onSubmit={(form) => protegido(async () => { await api(`/api/homenagem/${item.id}`, { method: 'PATCH', json: await jsonMemorial(form) }); setEditando(null); })} /> : null}
        {item.pode_editar && editando !== item.id ? <button type="button" className="btn btn-ghost min-h-11 w-full" disabled={busy} onClick={() => setEditando(item.id)}>Editar homenagem</button> : null}
        {item.pode_editar ? <button type="button" className="btn btn-quiet min-h-11 w-full" disabled={busy} onClick={() => { if (window.confirm('Apagar esta homenagem e as lembranças?')) void protegido(() => api(`/api/homenagem/${item.id}`, { method: 'DELETE' })); }}>Apagar homenagem</button> : null}
        <div className="rule" />
        <p className="kicker">Lembranças</p>
        {!item.lembrancas.length ? <p className="text-sm text-marfim-3">As lembranças da família aparecem aqui.</p> : null}
        {item.lembrancas.map((lembranca) => <div key={lembranca.id} className="space-y-2 border-t border-linha pt-4 first:border-0 first:pt-0">
          <div className="flex items-center gap-3"><Avatar name={lembranca.name} src={lembranca.avatar_url} /><p className="text-sm">{lembranca.name}</p></div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{lembranca.texto}</p>
          {lembranca.image_url ? <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumb(lembranca.image_url, 828)} alt="Foto da lembrança" className="max-h-72 w-full rounded-[14px] object-cover" />
          </> : null}
          {lembranca.pode_apagar ? <button type="button" className="btn btn-quiet min-h-11" disabled={busy} onClick={() => { if (window.confirm('Apagar esta lembrança?')) void protegido(() => api(`/api/homenagem/${item.id}/lembrancas/${lembranca.id}`, { method: 'DELETE' })); }}>Apagar lembrança</button> : null}
          {lembranca.user_id !== data.eu.id ? <ModerationActions userId={lembranca.user_id} name={lembranca.name} alvoTipo="homenagem" alvoId={lembranca.id} /> : null}
        </div>)}
        <FormLembranca busy={busy} onSubmit={(form) => protegido(async () => { await api(`/api/homenagem/${item.id}/lembrancas`, { method: 'POST', json: await jsonLembranca(form) }); form.reset(); })} />
      </article>)}
    </div>
  </>;
}

function MemorialCorpo({ item }: { item: Memorial }) {
  return <>
    {item.foto_url ? <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={thumb(item.foto_url, 828)} alt={item.nome} className="max-h-72 w-full rounded-[14px] object-cover" />
    </> : null}
    <div><p className="kicker">{item.anos}</p><h2 className="display mt-1 text-3xl">{item.nome}</h2></div>
    {item.texto ? <p className="whitespace-pre-wrap text-sm leading-relaxed text-marfim-2">{item.texto}</p> : null}
    <p className="text-xs text-marfim-3">Escrito por {item.autor_nome}</p>
    {item.pessoa_arvore_id ? <Link href={`/arvore#pessoa-${item.pessoa_arvore_id}`} className="text-sm text-champagne underline-offset-4 hover:underline">Ver na árvore</Link> : null}
  </>;
}

async function jsonMemorial(form: HTMLFormElement): Promise<Record<string, unknown>> {
  const f = new FormData(form);
  const arquivo = form.querySelector<HTMLInputElement>('input[type="file"]')?.files?.[0];
  const json: Record<string, unknown> = {
    nome: f.get('nome'), anos: f.get('anos'), texto: f.get('texto'),
    pessoa_arvore_id: f.get('pessoa') ? Number(f.get('pessoa')) : null,
  };
  if (arquivo) json.foto_url = await uploadImage(arquivo);
  else if (f.get('tirar') === 'sim') json.foto_url = null;
  return json;
}

async function jsonLembranca(form: HTMLFormElement): Promise<Record<string, unknown>> {
  const f = new FormData(form);
  const arquivo = form.querySelector<HTMLInputElement>('input[type="file"]')?.files?.[0];
  const json: Record<string, unknown> = { texto: f.get('texto') };
  if (arquivo) json.image_url = await uploadImage(arquivo);
  return json;
}

function FormMemorial({ pessoas, busy, memorial, onSubmit, cancelar }: {
  pessoas: HomenagemDados['pessoas'];
  busy: boolean;
  memorial?: Memorial;
  onSubmit: (form: HTMLFormElement) => Promise<void>;
  cancelar?: () => void;
}) {
  return <form className="mt-3 space-y-4" onSubmit={(event) => { event.preventDefault(); void onSubmit(event.currentTarget); }}>
    <label className="block text-sm text-marfim-2">Nome<input className="field mt-2" name="nome" required maxLength={120} defaultValue={memorial?.nome ?? ''} /></label>
    <label className="block text-sm text-marfim-2">Anos<input className="field mt-2" name="anos" required maxLength={40} placeholder="1932 - 2019" defaultValue={memorial?.anos ?? ''} /></label>
    <label className="block text-sm text-marfim-2">Um texto (opcional)<textarea className="field mt-2 min-h-28 resize-none" name="texto" maxLength={4000} defaultValue={memorial?.texto ?? ''} /></label>
    <label className="block text-sm text-marfim-2">Pessoa da árvore (opcional)
      <select className="field mt-2" name="pessoa" defaultValue={memorial?.pessoa_arvore_id ?? ''}>
        <option value="">Não ligar</option>
        {pessoas.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
      </select>
    </label>
    <label className="block text-sm text-marfim-2">Foto (opcional)<input className="field mt-2" type="file" accept="image/*" /></label>
    {memorial?.foto_url ? <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="tirar" value="sim" /> Tirar a foto</label> : null}
    <button className="btn btn-primary min-h-11 w-full" disabled={busy} type="submit">{memorial ? 'Salvar' : 'Criar homenagem'}</button>
    {cancelar ? <button className="btn btn-quiet min-h-11 w-full" type="button" onClick={cancelar}>Cancelar</button> : null}
  </form>;
}

function FormLembranca({ busy, onSubmit }: { busy: boolean; onSubmit: (form: HTMLFormElement) => Promise<void> }) {
  return <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void onSubmit(event.currentTarget); }}>
    <label className="block text-sm text-marfim-2">Deixar uma lembrança
      <textarea className="field mt-2 min-h-24 resize-none" name="texto" required maxLength={2000} />
    </label>
    <label className="block text-sm text-marfim-2">Foto (opcional)<input className="field mt-2" type="file" accept="image/*" /></label>
    <button className="btn btn-primary min-h-11 w-full" disabled={busy} type="submit">Publicar lembrança</button>
  </form>;
}
