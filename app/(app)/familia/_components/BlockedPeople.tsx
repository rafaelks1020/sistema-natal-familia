'use client';
import { useEffect, useState } from 'react';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { Loading } from './shared';
type Person = { id: number; name: string };
export default function BlockedPeople() {
  const toast = useToast();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    api<Person[]>('/api/blocks').then((data) => { if (active) { setPeople(data); setFailed(false); } }).catch((error: Error) => { if (active) { setFailed(true); toast(error.message, 'erro'); } });
    return () => { active = false; };
  }, [toast, attempt]);
  async function unblock(id: number) {
    setBusy(true);
    try { await api(`/api/blocks/${id}`, { method: 'DELETE' }); setPeople((current) => current?.filter((person) => person.id !== id) ?? []); toast('Pessoa desbloqueada.'); }
    catch (error) { toast((error as Error).message, 'erro'); }
    finally { setBusy(false); }
  }
  return <details className="my-5 border-y border-linha py-3 text-left"><summary className="min-h-11 cursor-pointer py-3 text-sm">Pessoas bloqueadas</summary>{failed ? <button className="btn btn-ghost" onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</button> : people === null ? <Loading /> : people.length === 0 ? <p className="py-4 text-sm text-marfim-3">Nenhuma pessoa bloqueada.</p> : people.map((person) => <div key={person.id} className="flex items-center justify-between gap-3 border-t border-linha py-2"><span className="text-sm">{person.name}</span><button disabled={busy} className="btn btn-quiet" onClick={() => void unblock(person.id)}>Desbloquear</button></div>)}</details>;
}
