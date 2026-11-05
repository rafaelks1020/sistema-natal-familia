'use client';
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from 'react';
import PageHeader from '@/app/ui/PageHeader';
import { api, uploadImage, thumb } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import type { OfficialData } from '@/app/api/festa/foto-oficial/data';
const endpoint = '/api/festa/foto-oficial';
export default function OfficialClient({ initial }: { initial: OfficialData }) {
  const [data, setData] = useState(initial);
  const atual = data.fotos.find((p) => p.ano === data.ano);
  const anterior = data.fotos.find((p) => p.ano === data.ano - 1);
  const [legenda, setLegenda] = useState(atual?.legenda ?? '');
  const [pose, setPose] = useState(atual?.dica_pose ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  async function save(remove = false) {
    if (lock.current || (!remove && !file)) return;
    lock.current = true; setBusy(true);
    try {
      if (remove) await api(endpoint, { method: 'DELETE' });
      else { const image_url = await uploadImage(file!); await api(endpoint, { method: 'PUT', json: { image_url, legenda, dica_pose: pose } }); }
      setData(await api<OfficialData>(endpoint)); setFile(null); if (input.current) input.current.value = '';
      toast(remove ? 'Foto removida.' : 'Foto oficial guardada!');
    } catch (e) { toast((e as Error).message, 'erro'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <><PageHeader back="/festa" kicker={`Natal ${data.ano}`} title="Foto oficial" /><div className="space-y-6 px-5 pb-8">
    <div><p className="kicker mb-2">Mesma pose todo ano</p><p className="text-sm text-marfim-2">Todo mundo no seu lugar. Repetir a pose faz parte da nossa história.</p></div>
    {!atual && <section className="space-y-3 rounded-2xl border border-champagne/30 p-5"><h2 className="display text-2xl">Vamos repetir a pose?</h2>{anterior ? <><img src={thumb(anterior.image_url)} alt={`Referência da pose de ${anterior.ano}`} className="aspect-[4/3] w-full rounded-xl object-contain" /><p className="text-sm text-marfim-2">Referência: Natal {anterior.ano}. {anterior.dica_pose || 'Escolham os mesmos lugares e sorriam juntos.'}</p></> : <p className="text-sm text-marfim-2">Nossa tradição começa aqui. Escolham os lugares de cada pessoa para repetir no próximo Natal.</p>}<p className="text-xs text-marfim-3">A foto de {data.ano} ainda será enviada por quem organiza.</p></section>}
    <section aria-label="Fotos oficiais por ano"><h2 className="display mb-3 text-2xl">Nossos Natais</h2><p className="mb-4 text-sm text-marfim-3">Deslize para comparar os anos.</p><div className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-4">{data.fotos.map((p) => <article key={p.id} className="w-[86%] shrink-0 snap-center overflow-hidden rounded-2xl border border-linha bg-carvao-2"><img src={thumb(p.image_url)} alt={p.legenda || `Foto oficial de ${p.ano}`} className="aspect-[4/3] w-full object-contain" loading="lazy" /><div className="space-y-2 p-5"><p className="kicker">Natal {p.ano}</p><p className="whitespace-pre-wrap break-words text-sm">{p.legenda}</p>{p.dica_pose && <p className="break-words text-sm text-marfim-2">A pose: {p.dica_pose}</p>}</div></article>)}</div>{!data.fotos.length && <p className="text-sm text-marfim-3">Em breve, a primeira foto da nossa tradição.</p>}</section>
    {data.is_admin && <form className="space-y-4 rounded-2xl border border-linha p-5" onSubmit={(e) => { e.preventDefault(); void save(); }}><h2 className="display text-2xl">{atual ? 'Trocar' : 'Enviar'} foto de {data.ano}</h2><label className="block text-sm">Foto da família<input ref={input} type="file" accept="image/*" className="field mt-2 w-full min-w-0 text-sm" disabled={busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label><label className="block text-sm">Legenda (opcional)<textarea className="field mt-2" maxLength={500} value={legenda} disabled={busy} onChange={(e) => setLegenda(e.target.value)} /></label><label className="block text-sm">Dica para repetir a pose<textarea className="field mt-2" maxLength={500} placeholder="Quem ficou em cada lugar?" value={pose} disabled={busy} onChange={(e) => setPose(e.target.value)} /></label><button disabled={busy || !file} className="btn btn-primary w-full">{busy ? 'Guardando...' : 'Guardar foto oficial'}</button>{atual && <button type="button" disabled={busy} className="btn btn-quiet min-h-11 w-full" onClick={() => { if (window.confirm('Remover a foto oficial deste ano?')) void save(true); }}>Remover foto deste ano</button>}</form>}
  </div></>;
}
