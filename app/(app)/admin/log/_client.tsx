'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/app/ui/PageHeader';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import type { LogItem, PaginaLog } from '@/app/lib/admin/tipos';
import { Empty, Loading } from '../../familia/_components/shared';
import { formatarData } from '../_lib';

export default function LogClient() {
  const toast = useToast();
  const [itens, setItens] = useState<LogItem[] | null>(null);
  const [proximo, setProximo] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    api<PaginaLog>('/api/admin/log')
      .then((p) => { if (ativo) { setItens(p.itens); setProximo(p.proximo); setFalhou(false); } })
      .catch((e: Error) => { if (ativo) { setFalhou(true); toast(e.message, 'erro'); } });
    return () => { ativo = false; };
  }, [toast, tentativa]);

  async function maisItens() {
    if (!proximo) return;
    setBusy(true);
    try {
      const p = await api<PaginaLog>(`/api/admin/log?cursor=${encodeURIComponent(proximo)}`);
      setItens((atual) => [...(atual ?? []), ...p.itens]);
      setProximo(p.proximo);
    } catch (e) { toast((e as Error).message, 'erro'); }
    finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-xl pb-10">
      <PageHeader kicker="Painel admin" title="Últimas ações" back="/admin" />
      <div className="px-5">
        {falhou ? <button className="btn btn-ghost" onClick={() => { setFalhou(false); setItens(null); setTentativa((v) => v + 1); }}>Tentar novamente</button>
          : itens === null ? <Loading />
          : !itens.length ? <Empty title="Nada por aqui ainda" text="Quando alguém organizar algo pelo painel, fica registrado aqui." />
          : <ul className="divide-y divide-linha border-y border-linha">
            {itens.map((l) => (
              <li key={l.id} className="py-4">
                <p className="text-sm"><span className="text-champagne">{l.quem}</span> fez <span className="font-semibold">{l.acao}</span> em {l.recurso}{l.alvo_id ? ` (nº ${l.alvo_id})` : ''}</p>
                {l.detalhe && <p className="mt-1 break-words text-xs text-marfim-2">{l.detalhe}</p>}
                <p className="mt-1 text-xs text-marfim-3">{formatarData(l.quando)}</p>
              </li>
            ))}
          </ul>}
        {proximo && <button className="btn btn-ghost mt-6 w-full" disabled={busy} onClick={() => void maisItens()}>{busy ? 'Buscando...' : 'Carregar mais'}</button>}
      </div>
    </main>
  );
}
