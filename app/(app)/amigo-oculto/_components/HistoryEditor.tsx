'use client';
import { useState } from 'react';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import type { AdminResponse } from './types';
export default function HistoryEditor({ onSaved }: { onSaved: () => void }) {
  const toast = useToast();
  const [people, setPeople] = useState<AdminResponse['participants']>([]), [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [year, setYear] = useState('2025'), [pairs, setPairs] = useState<Record<number, string>>({}), [confirmed, setConfirmed] = useState(false);
  async function load() {
    setBusy(true);
    try { setPeople((await api<AdminResponse>('/api/secret-santa/admin')).participants); setOpen(true); } catch (e) { toast((e as Error).message, 'erro'); } finally { setBusy(false); }
  }
  async function save(replace = false) {
    setBusy(true);
    try {
      await api('/api/secret-santa/history', { method: 'POST', json: { ano: Number(year), confirm_revealed: confirmed, replace, pairs: people.filter(p => pairs[p.id]).map(p => ({ giver_participant_id: p.id, receiver_participant_id: Number(pairs[p.id]) })) } });
      toast('Histórico salvo.'); setOpen(false); onSaved();
    } catch (e) { const message = (e as Error).message; if (!replace && message.includes('Confirme para substituir') && window.confirm(message)) await save(true); else toast(message, 'erro'); } finally { setBusy(false); }
  }
  return <section className="space-y-4"><button disabled={busy} className="btn btn-ghost w-full" onClick={() => void load()}>Cadastrar ano passado</button>{open && <form className="surface space-y-4 p-5" onSubmit={e => { e.preventDefault(); void save(); }}><label className="block">Ano<input className="field mt-2" inputMode="numeric" value={year} onChange={e => setYear(e.target.value)} required /></label><p className="text-sm text-marfim-2">Escolha quem cada pessoa tirou. Deixe em branco quem não participou.</p>{people.map(p => <label key={p.id} className="block">{p.name} tirou<select className="field mt-2" value={pairs[p.id] ?? ''} onChange={e => setPairs(v => ({ ...v, [p.id]: e.target.value }))}><option value="">Não participou</option>{people.filter(r => r.id !== p.id).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>)}<label className="flex min-h-11 items-center gap-3"><input required type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Esse ano já foi revelado e pode ser visto pela família.</label><button className="btn btn-primary w-full" disabled={busy}>Salvar histórico</button><button type="button" className="btn btn-quiet w-full" onClick={() => setOpen(false)}>Cancelar</button></form>}</section>;
}
