'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { diaLongo, faixa, parseBrMoney } from './format';
import type { AdminResponse, SantaConfig } from './types';

interface Rule {
  participant1_id: number;
  participant2_id: number;
}

function Confirm({
  title,
  body,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center">
      <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/70" onClick={() => { if (!busy) onClose(); }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="conf-titulo"
        className="relative w-full max-w-lg rounded-t-[18px] border border-linha bg-carvao-2 px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-6"
      >
        <h3 id="conf-titulo" className="display text-[1.8rem] leading-none">{title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-marfim-2">{body}</p>
        <button type="button" className="btn btn-primary mt-6 w-full" disabled={busy} onClick={onConfirm}>
          {busy ? 'Um instante…' : confirmLabel}
        </button>
        <button type="button" className="btn btn-ghost mt-3 w-full" disabled={busy} onClick={onClose}>
          Voltar
        </button>
      </div>
    </div>
  );
}

export default function Organize({ onChanged }: { onChanged: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AdminResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [date, setDate] = useState('');
  const [rules, setRules] = useState<Rule[]>([]);
  const [p1, setP1] = useState(0);
  const [p2, setP2] = useState(0);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<'draw' | 'cancel' | null>(null);

  useEffect(() => {
    if (!open || data) return;
    let cancel = false;
    setLoading(true);
    api<AdminResponse>('/api/secret-santa/admin')
      .then((res) => {
        if (cancel) return;
        setData(res);
        setPicked(res.participants.map((p) => p.id));
        if (res.config?.min_gift_value != null) setMin(String(res.config.min_gift_value));
        if (res.config?.max_gift_value != null) setMax(String(res.config.max_gift_value));
        if (res.config?.reveal_date) setDate(res.config.reveal_date);
      })
      .catch((err: Error) => {
        if (!cancel) toast(err.message, 'erro');
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [open, data, toast]);

  function togglePerson(id: number) {
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
    setPicked(next);
    setRules((rs) => rs.filter((r) => next.includes(r.participant1_id) && next.includes(r.participant2_id)));
    if (p1 === id) setP1(0);
    if (p2 === id) setP2(0);
  }

  function addRule() {
    if (!p1 || !p2 || p1 === p2) return;
    if (!picked.includes(p1) || !picked.includes(p2)) return;
    const key = [p1, p2].sort((a, b) => a - b).join(':');
    const exists = rules.some((r) => [r.participant1_id, r.participant2_id].sort((a, b) => a - b).join(':') === key);
    if (exists) return;
    setRules((rs) => [...rs, { participant1_id: p1, participant2_id: p2 }]);
    setP1(0);
    setP2(0);
  }

  function nameOf(id: number) {
    return data?.participants.find((p) => p.id === id)?.name ?? 'Alguém';
  }

  const chosen = data?.participants.filter((p) => picked.includes(p.id)) ?? [];
  const minN = parseBrMoney(min);
  const maxN = parseBrMoney(max);
  const ready = picked.length >= 3 && minN != null && maxN != null && minN <= maxN;

  async function draw() {
    setBusy(true);
    try {
      await api<{ config: SantaConfig }>('/api/secret-santa/admin', {
        method: 'POST',
        json: {
          action: 'draw',
          participant_ids: picked,
          min_gift_value: minN,
          max_gift_value: maxN,
          reveal_date: date || null,
          rules: rules.map((r) => ({ type: 'cannot_draw', ...r })),
        },
      });
      toast('Sorteio feito');
      setAsk(null);
      setData(null);
      setRules([]);
      onChanged();
    } catch (err) {
      toast((err as Error).message, 'erro');
      setAsk(null);
    } finally {
      setBusy(false);
    }
  }

  async function cancelDraw() {
    setBusy(true);
    try {
      await api('/api/secret-santa/admin', { method: 'DELETE' });
      toast('Sorteio cancelado');
      setAsk(null);
      setData(null);
      onChanged();
    } catch (err) {
      toast((err as Error).message, 'erro');
      setAsk(null);
    } finally {
      setBusy(false);
    }
  }

  const range = data?.config ? faixa(data.config.min_gift_value, data.config.max_gift_value) : null;
  const when = diaLongo(data?.config?.reveal_date);
  const opened = data?.status.filter((s) => s.revealed).length ?? 0;

  return (
    <section className="border-t border-linha pt-4">
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          <span className="kicker mb-1 block">Só quem organiza</span>
          <span className="display text-[1.6rem]">Organizar sorteio</span>
        </span>
        <ChevronDown size={20} strokeWidth={1.5} className={`shrink-0 text-marfim-3 transition-transform duration-700 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="rise mt-5 space-y-6">
          {loading && (
            <div className="space-y-3" aria-hidden>
              <div className="h-16 rounded-[14px] bg-carvao-3" />
              <div className="h-10 w-2/3 rounded-full bg-carvao-3" />
            </div>
          )}

          {data?.config && (
            <div className="space-y-3">
              <p className="kicker">Sorteio ativo</p>
              {range && <p className="numeral text-xl text-marfim">{range}</p>}
              {when && <p className="text-sm text-marfim-2">Data combinada: {when}</p>}
              <p className="text-sm text-marfim-2">
                {data.status.length === 0
                  ? 'Ninguém neste sorteio.'
                  : opened === 1
                    ? '1 pessoa já abriu'
                    : `${opened} de ${data.status.length} já abriram`}
              </p>
              <ul>
                {data.status.map((row, index) => (
                  <li key={`${row.name}-${index}`} className="flex items-center justify-between border-t border-linha py-3">
                    <span>{row.name}</span>
                    <span className="text-sm text-marfim-2">{row.revealed ? 'Já abriu' : 'Ainda não'}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-marfim-3">Os pares ficam só com cada pessoa.</p>
              <button type="button" className="btn btn-ghost" onClick={() => setAsk('cancel')}>
                Cancelar sorteio
              </button>
            </div>
          )}

          {data && (
            <div className="space-y-4">
              <h3 className="display text-[1.45rem]">{data.config ? 'Novo sorteio' : 'Quem entra'}</h3>
              {data.participants.length === 0 ? (
                <p className="text-sm text-marfim-2">Ainda não há pessoas na família.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.participants.map((p) => {
                    const on = picked.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => togglePerson(p.id)}
                        className={`min-h-11 max-w-full rounded-2xl border px-3 py-2 text-left text-sm leading-tight ${
                          on ? 'border-champagne text-marfim' : 'border-linha text-marfim-3'
                        }`}
                      >
                        {p.name}
                        {!p.has_login && <span className="mt-0.5 block text-[0.68rem] text-marfim-3">sem acesso</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-sm text-marfim-3">
                {picked.length < 3 ? `Faltam ${3 - picked.length} para sortear.` : `${picked.length} pessoas no sorteio.`}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs text-marfim-3">Valor mínimo</span>
                  <input className="field" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} placeholder="30" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs text-marfim-3">Valor máximo</span>
                  <input className="field" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} placeholder="80" />
                </label>
              </div>
              {minN != null && maxN != null && minN > maxN && (
                <p className="text-sm text-cereja">O mínimo passou do máximo.</p>
              )}
              <label className="block">
                <span className="mb-1.5 block text-xs text-marfim-3">Data combinada (opcional)</span>
                <input className="field ao-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                <style>{`.ao-date::-webkit-calendar-picker-indicator{filter:invert(.85);opacity:.75}`}</style>
              </label>

              <div>
                <p className="mb-2 text-sm text-marfim">Quem não pode se tirar</p>
                <p className="mb-3 text-sm text-marfim-3">Casais, irmãos, quem mora junto. Vale para os dois lados.</p>
                {rules.length > 0 && (
                  <ul className="mb-3">
                    {rules.map((rule) => (
                      <li key={`${rule.participant1_id}-${rule.participant2_id}`} className="flex items-center justify-between gap-2 border-t border-linha py-1">
                        <span className="text-sm">{nameOf(rule.participant1_id)} e {nameOf(rule.participant2_id)}</span>
                        <button
                          type="button"
                          aria-label="Tirar esta regra"
                          className="flex h-11 w-11 items-center justify-center text-marfim-3"
                          onClick={() => setRules((rs) => rs.filter((r) => r !== rule))}
                        >
                          <X size={16} strokeWidth={1.5} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="space-y-2">
                  <select className="field" value={p1} onChange={(e) => setP1(Number(e.target.value))} aria-label="Primeira pessoa da regra">
                    <option value={0}>Pessoa 1</option>
                    {chosen.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select className="field" value={p2} onChange={(e) => setP2(Number(e.target.value))} aria-label="Segunda pessoa da regra">
                    <option value={0}>Pessoa 2</option>
                    {chosen.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button type="button" className="btn btn-ghost w-full" disabled={!p1 || !p2 || p1 === p2} onClick={addRule}>
                    Não podem se tirar
                  </button>
                </div>
              </div>

              <button type="button" className="btn btn-primary w-full" disabled={!ready || busy} onClick={() => setAsk('draw')}>
                {data.config ? 'Sortear de novo' : 'Sortear'}
              </button>
            </div>
          )}
        </div>
      )}

      {ask === 'draw' && (
        <Confirm
          title="Fazer o sorteio?"
          body={`Entram ${picked.length} pessoas. Presentes de ${faixa(minN, maxN) ?? 'valor combinado'}. Se já existe um sorteio, ele deixa de valer. Cada um só descobre o próprio nome, e você também. A lista de desejos deste sorteio começa vazia.`}
          confirmLabel="Sortear agora"
          busy={busy}
          onConfirm={() => void draw()}
          onClose={() => { if (!busy) setAsk(null); }}
        />
      )}
      {ask === 'cancel' && (
        <Confirm
          title="Cancelar o sorteio?"
          body="A tela volta a dizer que o sorteio não aconteceu. As listas de desejos deste sorteio continuam aqui até o próximo."
          confirmLabel="Cancelar sorteio"
          busy={busy}
          onConfirm={() => void cancelDraw()}
          onClose={() => { if (!busy) setAsk(null); }}
        />
      )}
    </section>
  );
}
