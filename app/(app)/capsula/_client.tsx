'use client';
import { useRef, useState } from 'react';
import { api, uploadImage } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import Avatar from '@/app/ui/Avatar';
import PageHeader from '@/app/ui/PageHeader';
import { thumb } from '@/app/ui/thumb';
import ModerationActions from '../mural/_components/ModerationActions';
import type { CapsulaDados, PessoaResumo } from '@/app/api/capsula/_data';

export default function CapsulaClient({ initial }: { initial: CapsulaDados }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);
  const lock = useRef(false);
  const toast = useToast();

  async function fotoDoForm(form: HTMLFormElement): Promise<string | null | undefined> {
    const arquivo = form.querySelector<HTMLInputElement>('input[type="file"]')?.files?.[0];
    if (!arquivo) return undefined;
    return uploadImage(arquivo);
  }

  async function protegido(trabalho: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await trabalho();
      try {
        setData(await api<CapsulaDados>('/api/capsula'));
        toast('Pronto, atualizado.');
      } catch {
        toast('Salvo. Recarregue a página para atualizar a lista.', 'erro');
      }
    } catch (e) {
      toast((e as Error).message, 'erro');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return <>
    <style>{`
      @keyframes capsula-lacre {
        0% { transform: scale(1); opacity: 1; }
        60% { transform: scale(1.06); opacity: 1; }
        100% { transform: scale(1.4); opacity: 0; }
      }
      .capsula-lacre { animation: capsula-lacre 1.6s ease forwards; }
    `}</style>
    <PageHeader title="Cápsula do tempo" kicker={`Natal ${data.ano}`} back="/familia" />
    <div className="space-y-7 px-5 pb-12">
      <p className="text-sm leading-relaxed text-marfim-2">Escreva hoje. A mensagem fica lacrada e só abre na ceia do ano que vem, em {data.abertura_texto}.</p>
      <section className="surface p-5">
        <p className="kicker">Lacrada</p>
        <p className="display mt-2 text-3xl leading-tight">{data.frase}</p>
      </section>
      <details className="surface p-5">
        <summary className="min-h-11 cursor-pointer py-3 text-champagne">Guardar uma mensagem</summary>
        <form className="mt-3 space-y-4" onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const f = new FormData(form);
          void protegido(async () => {
            const image_url = await fotoDoForm(form);
            const para = String(f.get('para') ?? '');
            await api('/api/capsula', { method: 'POST', json: { texto: f.get('texto'), para_user_id: para ? Number(para) : null, image_url: image_url ?? null } });
            form.reset();
          });
        }}>
          <Destino familia={data.familia} eu={data.eu.id} />
          <label className="block text-sm text-marfim-2">Mensagem
            <textarea className="field mt-2 min-h-32 resize-none" name="texto" required maxLength={4000} placeholder="O que você quer que a família leia na próxima ceia?" />
          </label>
          <label className="block text-sm text-marfim-2">Foto (opcional)
            <input className="field mt-2" name="foto" type="file" accept="image/*" />
          </label>
          <button className="btn btn-primary min-h-11 w-full" disabled={busy} type="submit">Guardar mensagem</button>
        </form>
      </details>
      {data.minhas.map((item) => <article key={item.id} className="surface space-y-3 p-5">
        <p className="kicker">Sua mensagem</p>
        <h2 className="display text-2xl">Para {item.para_nome}</h2>
        <p className="text-sm text-marfim-2">Lacrada. Abre em {item.abre_em_texto}.{item.tem_foto ? ' Tem uma foto junto.' : ''}</p>
        <p className="text-sm text-marfim-3">Ninguém consegue ler enquanto estiver fechada, nem você.</p>
        {item.pode_editar && editando === item.id ? <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const f = new FormData(form);
          void protegido(async () => {
            const enviada = await fotoDoForm(form);
            const para = String(f.get('para') ?? '');
            const json: Record<string, unknown> = { texto: f.get('texto'), para_user_id: para ? Number(para) : null };
            if (enviada) json.image_url = enviada;
            else if (f.get('tirar') === 'sim') json.image_url = null;
            await api(`/api/capsula/${item.id}`, { method: 'PATCH', json });
            setEditando(null);
          });
        }}>
          <Destino familia={data.familia} eu={data.eu.id} padrao={item.para_user_id} />
          <label className="block text-sm text-marfim-2">Nova mensagem
            <textarea className="field mt-2 min-h-32 resize-none" name="texto" required maxLength={4000} placeholder="A anterior continua lacrada. Esta aqui substitui ela." />
          </label>
          <label className="block text-sm text-marfim-2">Nova foto (opcional)
            <input className="field mt-2" type="file" accept="image/*" />
          </label>
          {item.tem_foto ? <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="tirar" value="sim" /> Tirar a foto antiga</label> : null}
          <button className="btn btn-primary min-h-11 w-full" disabled={busy} type="submit">Substituir mensagem</button>
          <button className="btn btn-quiet min-h-11 w-full" type="button" onClick={() => setEditando(null)}>Cancelar</button>
        </form> : null}
        {item.pode_editar && editando !== item.id ? <button className="btn btn-ghost min-h-11 w-full" disabled={busy} type="button" onClick={() => setEditando(item.id)}>Trocar mensagem</button> : null}
        {item.pode_editar || data.eu.admin ? <button className="btn btn-quiet min-h-11 w-full" disabled={busy} type="button" onClick={() => { if (window.confirm('Apagar esta mensagem lacrada?')) void protegido(() => api(`/api/capsula/${item.id}`, { method: 'DELETE' })); }}>Apagar</button> : null}
      </article>)}
      {data.aguardando ? <p className="text-sm text-marfim-2">{data.aguardando.total === 1 ? '1 mensagem abre' : `${data.aguardando.total} mensagens abrem`} em {data.aguardando.abre_em_texto}. Até lá, o texto fica guardado.</p> : null}
      {data.abertas.length ? <section className="space-y-4">
        <div className="surface relative overflow-hidden px-5 py-8 text-center">
          <div className="capsula-lacre pointer-events-none absolute left-1/2 top-6 h-16 w-16 -translate-x-1/2 rounded-full border border-champagne bg-cereja/80" aria-hidden />
          <p className="kicker">Aberta</p>
          <h2 className="display mt-2 text-3xl">A cápsula abriu</h2>
          <p className="mt-2 text-sm text-marfim-2">As mensagens guardadas no Natal anterior estão aqui.</p>
        </div>
        <div className="stagger space-y-4">
          {data.abertas.map((item) => <article key={item.id} className="surface min-w-0 space-y-3 break-words p-5">
            <div className="flex items-center gap-3"><Avatar name={item.author_name} src={item.avatar_url} /><div className="min-w-0"><p className="kicker">Para {item.para_nome}</p><p>{item.author_name}</p></div></div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.texto}</p>
            {item.image_url ? <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb(item.image_url, 828)} alt="Foto da mensagem" className="max-h-80 w-full rounded-[14px] object-cover" />
            </> : null}
            {item.pode_apagar ? <button className="btn btn-quiet min-h-11 w-full" disabled={busy} type="button" onClick={() => { if (window.confirm('Apagar esta mensagem?')) void protegido(() => api(`/api/capsula/${item.id}`, { method: 'DELETE' })); }}>Apagar</button> : null}
            {item.user_id !== data.eu.id ? <ModerationActions userId={item.user_id} name={item.author_name} alvoTipo="capsula" alvoId={item.id} /> : null}
          </article>)}
        </div>
      </section> : null}
    </div>
  </>;
}

function Destino({ familia, eu, padrao = null }: { familia: PessoaResumo[]; eu: number; padrao?: number | null }) {
  return <label className="block text-sm text-marfim-2">Para quem
    <select className="field mt-2" name="para" defaultValue={padrao ?? ''}>
      <option value="">A família toda</option>
      {familia.map((pessoa) => <option key={pessoa.id} value={pessoa.id}>{pessoa.id === eu ? `${pessoa.name} (para mim)` : pessoa.name}</option>)}
    </select>
  </label>;
}
