'use client';

import { useEffect, useState, type FormEvent } from 'react';
import PageHeader from '@/app/ui/PageHeader';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import type { AvisoAgendado } from '@/app/lib/admin/painel-tipos';
import { Loading } from '../../familia/_components/shared';
import { formatarData } from '../_lib';

type Lista = { ativo: boolean; pendentes: AvisoAgendado[]; enviados: AvisoAgendado[] };

function destino(aviso: AvisoAgendado): string {
  if (aviso.todos) return 'Toda a família';
  const n = aviso.pessoas ?? 0;
  return `${n} ${n === 1 ? 'pessoa' : 'pessoas'}`;
}

export default function AvisosClient() {
  const toast = useToast();
  const [lista, setLista] = useState<Lista | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [titulo, setTitulo] = useState('');
  const [corpo, setCorpo] = useState('');
  const [rota, setRota] = useState('');
  const [quando, setQuando] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancelando, setCancelando] = useState<number | null>(null);

  useEffect(() => {
    let ativo = true;
    api<Lista>('/api/admin/avisos-agendados')
      .then((r) => { if (ativo) { setLista(r); setFalhou(false); } })
      .catch((e: Error) => { if (ativo) { setFalhou(true); toast(e.message, 'erro'); } });
    return () => { ativo = false; };
  }, [toast, tentativa]);

  async function criar(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/admin/avisos-agendados', {
        method: 'POST',
        json: { titulo, corpo, enviar_em: quando, ...(rota.trim() ? { rota: rota.trim() } : {}) },
      });
      toast('Aviso agendado.');
      setTitulo('');
      setCorpo('');
      setRota('');
      setQuando('');
      setTentativa((v) => v + 1);
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setBusy(false);
    }
  }

  async function cancelar(aviso: AvisoAgendado) {
    if (!window.confirm(`Cancelar o aviso "${aviso.titulo}"? Ele não será enviado.`)) return;
    setCancelando(aviso.id);
    try {
      await api(`/api/admin/avisos-agendados/${aviso.id}`, { method: 'DELETE' });
      toast('Aviso cancelado.');
      setTentativa((v) => v + 1);
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setCancelando(null);
    }
  }

  return (
    <main className="mx-auto max-w-xl pb-10">
      <PageHeader kicker="No horário de São Paulo" title="Avisos" back="/admin" />
      <div className="space-y-10 px-5">
        {falhou ? (
          <button className="btn btn-ghost w-full" onClick={() => { setFalhou(false); setTentativa((v) => v + 1); }}>Tentar novamente</button>
        ) : !lista ? <Loading /> : (
          <>
            {!lista.ativo && (
              <p className="text-sm text-marfim-2">Os avisos agendados ainda não estão ativos. Falta aplicar a atualização do banco.</p>
            )}
            <form className="space-y-4" onSubmit={(e) => { void criar(e); }}>
              <label className="block text-sm text-marfim-2">Título
                <input className="field mt-2" required maxLength={80} value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={!lista.ativo || busy} />
              </label>
              <label className="block text-sm text-marfim-2">Mensagem
                <textarea className="field mt-2" rows={3} required maxLength={240} value={corpo} onChange={(e) => setCorpo(e.target.value)} disabled={!lista.ativo || busy} />
              </label>
              <label className="block text-sm text-marfim-2">Tela que abre ao tocar (opcional)
                <input className="field mt-2" maxLength={100} placeholder="/mural" value={rota} onChange={(e) => setRota(e.target.value)} disabled={!lista.ativo || busy} />
              </label>
              <label className="block text-sm text-marfim-2">Data e hora
                <input className="field mt-2" type="datetime-local" required value={quando} onChange={(e) => setQuando(e.target.value)} disabled={!lista.ativo || busy} />
                <span className="mt-2 block text-xs text-marfim-3">Horário de São Paulo. O aviso sai para toda a família.</span>
              </label>
              <button className="btn btn-primary w-full" disabled={!lista.ativo || busy}>{busy ? 'Salvando...' : 'Agendar aviso'}</button>
            </form>

            <section aria-labelledby="pendentes">
              <h2 id="pendentes" className="kicker mb-3">Pendentes</h2>
              {lista.pendentes.length === 0 ? <p className="text-sm text-marfim-2">Nenhum aviso esperando o horário.</p> : (
                <ul className="space-y-4">
                  {lista.pendentes.map((aviso) => (
                    <li key={aviso.id} className="border-y border-linha py-3">
                      <p className="text-sm font-semibold">{aviso.titulo}</p>
                      <p className="mt-1 text-sm text-marfim-2">{aviso.corpo}</p>
                      <p className="mt-1 text-xs text-marfim-3">{formatarData(aviso.enviar_em)} · {destino(aviso)}</p>
                      <button className="btn btn-quiet mt-2 min-h-11" disabled={cancelando === aviso.id} onClick={() => { void cancelar(aviso); }}>
                        {cancelando === aviso.id ? 'Cancelando...' : 'Cancelar'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="enviados">
              <h2 id="enviados" className="kicker mb-3">Enviados</h2>
              {lista.enviados.length === 0 ? <p className="text-sm text-marfim-2">Nenhum aviso enviado por aqui ainda.</p> : (
                <ul className="divide-y divide-linha border-y border-linha">
                  {lista.enviados.map((aviso) => (
                    <li key={aviso.id} className="py-3">
                      <p className="text-sm">{aviso.titulo}</p>
                      <p className="mt-1 text-xs text-marfim-3">Enviado em {formatarData(aviso.enviado_em)} · {destino(aviso)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
