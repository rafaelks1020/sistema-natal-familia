'use client';
import { useCallback, useEffect, useState } from 'react';
import { Clock, Plus, Sparkles, Trash2 } from 'lucide-react';
import { api } from '@/app/ui/client';
import {
  itemAtivo,
  OPCOES_ACAO_ROTEIRO,
  proximoItem,
  rotuloAcaoRoteiro,
  type ItemRoteiro,
} from '../roteiro';

export interface RoteiroControleProps {
  itensIniciais?: ItemRoteiro[];
  aoMudar?: (itens: ItemRoteiro[]) => void;
}

interface RespostaRoteiro {
  ano: number;
  itens: ItemRoteiro[];
}

export function RoteiroControle({ itensIniciais, aoMudar }: RoteiroControleProps = {}) {
  const [itens, setItens] = useState<ItemRoteiro[]>(itensIniciais ?? []);
  const [hora, setHora] = useState('20:00');
  const [acao, setAcao] = useState<string>(OPCOES_ACAO_ROTEIRO[0].valor);
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const atualizarLista = useCallback(
    (novos: ItemRoteiro[]) => {
      setItens(novos);
      aoMudar?.(novos);
    },
    [aoMudar],
  );

  const carregar = useCallback(async () => {
    try {
      const res = await api<RespostaRoteiro | ItemRoteiro[]>('/api/telao/roteiro');
      const lista = Array.isArray(res) ? res : (res.itens ?? []);
      atualizarLista(lista);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }, [atualizarLista]);

  useEffect(() => {
    const t = setTimeout(() => void carregar(), 0);
    return () => clearTimeout(t);
  }, [carregar]);

  async function adicionar(ev: React.FormEvent) {
    ev.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await api<RespostaRoteiro>('/api/telao/roteiro', {
        method: 'POST',
        json: {
          hora,
          acao,
          ...(acao === 'aviso' ? { texto: texto.trim() } : {}),
        },
      });
      atualizarLista(res.itens ?? []);
      if (acao === 'aviso') setTexto('');
      setMsg('Horário adicionado ao roteiro.');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function apagar(id: number) {
    if (busy) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await api<RespostaRoteiro>(`/api/telao/roteiro?id=${id}`, { method: 'DELETE' });
      atualizarLista(res.itens ?? []);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function usarPadrao() {
    if (busy) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await api<RespostaRoteiro>('/api/telao/roteiro', {
        method: 'POST',
        json: { modelo: true },
      });
      atualizarLista(res.itens ?? []);
      setMsg('Roteiro padrão da noite de Natal aplicado.');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const agoraMs = Date.now();
  const ativo = itemAtivo(itens, agoraMs);
  const proximo = proximoItem(itens, agoraMs);

  return (
    <section className="surface mb-4 p-4" aria-label="Roteiro da noite">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="kicker">Roteiro da noite</p>
        {proximo && (
          <span className="inline-flex items-center gap-1 text-xs text-champagne">
            <Clock size={14} /> Próximo às {proximo.hora}
          </span>
        )}
      </div>

      {itens.length === 0 ? (
        <p className="mb-4 text-sm text-marfim-2">
          Nenhum horário programado ainda. Você pode montar abaixo ou usar o roteiro pronto da véspera de Natal.
        </p>
      ) : (
        <ul className="mb-4 divide-y divide-white/10">
          {itens.map((item) => {
            const ehAtivo = ativo?.id === item.id;
            return (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-champagne">{item.hora}</span>
                    <span className="truncate text-marfim">{rotuloAcaoRoteiro(item.acao, item.texto)}</span>
                    {ehAtivo && (
                      <span className="rounded-full bg-champagne/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-champagne">
                        ativo
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void apagar(item.id)}
                  className="btn btn-quiet min-h-9 px-2.5 text-marfim-3 hover:text-cereja"
                  aria-label={`Apagar horário ${item.hora}`}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={(ev) => void adicionar(ev)} className="space-y-3 border-t border-white/10 pt-3">
        <div className="grid grid-cols-[110px_1fr] gap-2">
          <label className="block text-xs text-marfim-2">
            Hora
            <input
              type="time"
              required
              value={hora}
              onChange={(ev) => setHora(ev.target.value)}
              className="field mt-1"
            />
          </label>
          <label className="block text-xs text-marfim-2">
            Ação
            <select
              value={acao}
              onChange={(ev) => setAcao(ev.target.value)}
              className="field mt-1"
            >
              {OPCOES_ACAO_ROTEIRO.map((op) => (
                <option key={op.valor} value={op.valor}>
                  {op.rotulo}
                </option>
              ))}
            </select>
          </label>
        </div>

        {acao === 'aviso' && (
          <label className="block text-xs text-marfim-2">
            Texto do aviso
            <input
              type="text"
              required
              maxLength={120}
              value={texto}
              onChange={(ev) => setTexto(ev.target.value)}
              placeholder="Bem-vindos à nossa ceia!"
              className="field mt-1"
            />
          </label>
        )}

        <button
          type="submit"
          disabled={busy || (acao === 'aviso' && !texto.trim())}
          className="btn btn-primary w-full"
        >
          <Plus size={18} /> Adicionar ao roteiro
        </button>
      </form>

      <button
        type="button"
        disabled={busy}
        onClick={() => void usarPadrao()}
        className="btn btn-ghost mt-3 w-full"
      >
        <Sparkles size={16} /> Usar roteiro padrão da noite de Natal
      </button>

      {msg && (
        <p role="status" className="mt-3 text-center text-xs text-champagne">
          {msg}
        </p>
      )}
    </section>
  );
}

export default RoteiroControle;
