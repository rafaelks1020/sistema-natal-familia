'use client';

import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { api } from '@/app/ui/client';
import type { PendenteAoVivo, RespostaAoVivo } from '../_aovivo';

/** Lista de recados pendentes. Atualiza a cada 4 s. Só faz sentido para quem organiza. */
export function ModeracaoAoVivo() {
  const [pendentes, setPendentes] = useState<PendenteAoVivo[]>([]);
  const [erro, setErro] = useState('');
  const [ocupados, setOcupados] = useState<Set<number>>(new Set());

  useEffect(() => {
    let vivo = true;
    const ler = async () => {
      try {
        const data = await api<RespostaAoVivo>('/api/telao/ao-vivo?desde=0');
        if (!vivo) return;
        setPendentes(data.pendentes ?? []);
        setErro('');
      } catch (err) {
        if (!vivo) return;
        setErro((err as Error).message);
      }
    };
    const primeira = window.setTimeout(() => void ler(), 0);
    const timer = window.setInterval(() => void ler(), 4000);
    return () => {
      vivo = false;
      window.clearTimeout(primeira);
      window.clearInterval(timer);
    };
  }, []);

  async function moderar(id: number, status: 'aprovado' | 'recusado') {
    setOcupados((atual) => new Set(atual).add(id));
    setErro('');
    try {
      await api('/api/telao/ao-vivo', { method: 'PATCH', json: { id, status } });
      setPendentes((atual) => atual.filter((r) => r.id !== id));
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setOcupados((atual) => {
        const prox = new Set(atual);
        prox.delete(id);
        return prox;
      });
    }
  }

  return <section className="surface mt-4 p-4" aria-label="Recados ao vivo">
    <p className="kicker mb-3">Recados ao vivo</p>
    {pendentes.length === 0 ? <p className="text-sm text-marfim-2">Nenhum recado esperando aprovação.</p> : <ul className="grid gap-3">
      {pendentes.map((r) => <li key={r.id} className="rounded-2xl border border-linha bg-carvao px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-widest text-champagne">{r.nome}</p>
        <p className="mt-2 text-base leading-snug text-marfim">{r.texto}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-primary" disabled={ocupados.has(r.id)} onClick={() => void moderar(r.id, 'aprovado')}><Check size={18} /> Aprovar</button>
          <button type="button" className="btn btn-ghost" disabled={ocupados.has(r.id)} onClick={() => void moderar(r.id, 'recusado')}><X size={18} /> Recusar</button>
        </div>
      </li>)}
    </ul>}
    {erro && <p role="alert" className="mt-3 text-center text-sm text-champagne">{erro}</p>}
  </section>;
}
