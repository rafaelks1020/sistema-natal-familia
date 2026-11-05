'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
export interface LivePair { giver_id: number; receiver_id: number; giver: string; receiver: string; acertos: string[] }
export interface LiveData { live: { atual: number; total: number; iniciado_em: string; encerrado_em: string | null; pairs: LivePair[] } | null }
function Reveal({ pair }: { pair: LivePair }) {
  const [shown, setShown] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShown(true), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1800); return () => clearTimeout(t); }, []);
  return <section className="surface space-y-5 px-6 py-12 text-center" aria-live="polite">{!shown ? <><p className="motion-safe:animate-pulse display text-4xl text-champagne">Quem será?</p><p>O segredo vai acabar...</p></> : <><p className="display break-words text-3xl">{pair.giver}</p><p className="kicker">tirou</p><p className="display break-words text-4xl text-champagne">{pair.receiver}</p><p className="text-sm text-marfim-2">{pair.acertos.length ? `Acertou o palpite: ${pair.acertos.join(', ')}` : 'Esse segredo foi bem guardado!'}</p></>}</section>;
}
export default function LiveClient({ initial, isAdmin }: { initial: LiveData; isAdmin: boolean }) {
  const [data, setData] = useState(initial), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => {
    let stopped = false;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try { const result = await api<LiveData>('/api/secret-santa/live', { signal: controller.signal }); if (!stopped) { setData(result); setError(''); } }
      catch (e) { if (!stopped) setError((e as Error).message); }
      finally { if (!stopped) timer = setTimeout(() => void poll(), 2000); }
    }
    timer = setTimeout(() => void poll(), 2000);
    return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, []);
  async function advance() {
    if (busy) return;
    if (!data.live && !window.confirm('Começar a revelação para toda a família? Os palpites serão encerrados.')) return;
    setBusy(true);
    try { setData(await api<LiveData>('/api/secret-santa/live', { method: 'POST', json: { action: data.live ? 'next' : 'start', atual: data.live?.atual ?? -1 } })); }
    catch (e) { toast((e as Error).message, 'erro'); } finally { setBusy(false); }
  }
  const live = data.live, pair = live?.pairs.at(-1);
  return <div className="space-y-6 px-5 pb-10">{error && <p role="alert" className="text-sm text-marfim-2">{error} Tentando atualizar...</p>}{pair ? <Reveal key={pair.giver_id} pair={pair} /> : <section className="surface space-y-5 p-8 text-center"><p className="display motion-safe:animate-pulse text-3xl">{live ? 'O primeiro segredo vem aí...' : 'Junte a família'}</p><p className="text-marfim-2">{live ? 'Quem organiza vai anunciar o primeiro par.' : 'A revelação aparece aqui quando quem organiza começar.'}</p></section>}
    {live && <p className="kicker text-center">{Math.max(0, live.atual + 1)} de {live.total}{live.encerrado_em ? ' · Todos os segredos revelados' : ''}</p>}
    {isAdmin && !live?.encerrado_em && <button disabled={busy} className="btn btn-primary w-full" onClick={() => void advance()}>{busy ? 'Um instante...' : live ? 'Próximo' : 'Iniciar revelação'}</button>}
    {live && live.pairs.length > 1 && <section className="space-y-3"><h2 className="display text-2xl">Já revelados</h2>{live.pairs.slice(0, -1).map(p => <p key={p.giver_id} className="break-words border-b border-linha py-3">{p.giver} tirou {p.receiver}</p>)}</section>}
    <Link href="/amigo-oculto" className="btn btn-ghost w-full">Voltar ao amigo oculto</Link>
  </div>;
}
