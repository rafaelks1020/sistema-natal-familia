'use client';
import { useState } from 'react';
import { api, brl } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';

type Meta = { meta_centavos: number; arrecadado_centavos: number; contribuintes: number; destino: string; ano: number };
export default function GoalCard({ data, isAdmin, onSaved }: { data: Meta; isAdmin: boolean; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(data.meta_centavos / 100).replace('.', ','));
  const [destino, setDestino] = useState(data.destino);
  const [busy, setBusy] = useState(false);
  const progress = data.meta_centavos ? Math.min(100, data.arrecadado_centavos / data.meta_centavos * 100) : 0;
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) { toast('Informe a meta em reais, por exemplo 1500,00.', 'erro'); return; }
    setBusy(true);
    try {
      await api('/api/vaquinha/meta', { method: 'PUT', json: { meta_centavos: Math.round(Number(value.replace(',', '.')) * 100), destino } });
      await onSaved(); setEditing(false); toast('Meta atualizada.');
    } catch (error) { toast((error as Error).message, 'erro'); }
    finally { setBusy(false); }
  }
  return <section className="surface mb-4 space-y-4 p-5" aria-label="Meta da vaquinha">
    <p className="kicker">Nosso Natal de {data.ano}</p>
    <h2 className="display text-2xl">Cada contribuição aproxima a ceia</h2>
    <p className="numeral text-3xl text-champagne">{brl(data.arrecadado_centavos / 100)}<span className="block text-base text-marfim-2">{data.meta_centavos ? `de ${brl(data.meta_centavos / 100)}` : 'Meta ainda não definida'}</span></p>
    <div role="progressbar" aria-label="Arrecadação confirmada em relação à meta" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} className="h-2 overflow-hidden rounded-full bg-carvao-3"><div className="h-full rounded-full bg-salvia transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${progress}%` }} /></div>
    {data.meta_centavos > 0 ? <p>{progress >= 100 ? 'Meta alcançada. Obrigado, família!' : `Faltam ${brl(Math.max(0, data.meta_centavos - data.arrecadado_centavos) / 100)}`}</p> : null}
    <p className="text-sm text-marfim-2">{data.contribuintes} {data.contribuintes === 1 ? 'pessoa já contribuiu' : 'pessoas já contribuíram'} com pagamento confirmado.</p>
    {data.destino ? <p className="whitespace-pre-line break-words text-sm"><strong>Destino do dinheiro:</strong> {data.destino}</p> : null}
    {isAdmin ? <button className="btn btn-quiet min-h-11" onClick={() => setEditing(!editing)}>{editing ? 'Cancelar' : 'Definir meta e destino'}</button> : null}
    {editing ? <form onSubmit={save} className="space-y-3"><label className="block text-sm">Meta em reais<input className="field mt-2" inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} maxLength={13} required /></label><label className="block text-sm">Para que vamos usar o dinheiro?<textarea className="field mt-2" value={destino} onChange={e => setDestino(e.target.value)} maxLength={500} required /></label><button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Salvando...' : 'Salvar meta'}</button></form> : null}
  </section>;
}
