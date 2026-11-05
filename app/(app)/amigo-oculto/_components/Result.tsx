'use client';

import { useEffect, useState } from 'react';
import { Check, ExternalLink, Eye, EyeOff } from 'lucide-react';
import Avatar from '@/app/ui/Avatar';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { faixa, storeLink } from './format';
import Stars from './Stars';
import type { Receiver, SantaConfig, WishItem, WishResponse } from './types';

const HIDE_KEY = 'nf-ocultar-nome';

export default function Result({
  config,
  receiver,
  forceShow = false,
}: {
  config: SantaConfig;
  receiver: Receiver;
  forceShow?: boolean;
}) {
  const toast = useToast();
  // O resultado só monta no cliente, depois do fetch. Ler a preferência aqui
  // evita pintar o nome e esconder em seguida.
  const [hidden, setHidden] = useState(() => {
    if (forceShow) return false;
    if (typeof window === 'undefined') return true;
    return sessionStorage.getItem(HIDE_KEY) === '1';
  });
  const [items, setItems] = useState<WishItem[] | null>(null);
  const [listError, setListError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    let cancel = false;
    setListError('');
    api<WishResponse>(`/api/wishlist?participant_id=${receiver.participant_id}`)
      .then((res) => {
        if (!cancel) setItems(res.items);
      })
      .catch((err: Error) => {
        if (!cancel) setListError(err.message);
      });
    return () => {
      cancel = true;
    };
  }, [receiver.participant_id]);

  function toggleHide() {
    const next = !hidden;
    setHidden(next);
    if (next) sessionStorage.setItem(HIDE_KEY, '1');
    else sessionStorage.removeItem(HIDE_KEY);
  }

  async function mark(item: WishItem) {
    if (typeof item.purchased !== 'boolean' || busyId != null) return;
    const next = !item.purchased;
    setBusyId(item.id);
    try {
      const saved = await api<WishItem>(`/api/wishlist/${item.id}`, {
        method: 'PUT',
        json: { purchased: next },
      });
      setItems((xs) => xs?.map((row) => (row.id === item.id ? { ...row, purchased: saved.purchased } : row)) ?? xs);
      if (next) toast('Anotado');
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setBusyId(null);
    }
  }

  const range = faixa(config.min_gift_value, config.max_gift_value);

  return (
    <section className="surface rise relative overflow-hidden px-5 pb-2 pt-5" aria-live="polite">
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={toggleHide}
          className="inline-flex min-h-11 items-center gap-2 px-2 text-sm text-marfim-2"
          aria-pressed={hidden}
        >
          {hidden ? <Eye size={18} strokeWidth={1.5} /> : <EyeOff size={18} strokeWidth={1.5} />}
          {hidden ? 'Mostrar o nome' : 'Esconder o nome'}
        </button>
      </div>

      <p className="display-italic text-center text-[1.7rem] text-champagne">Você tirou</p>
      <div className="mx-auto mt-3 h-px w-12 bg-cereja" />

      {hidden ? (
        <div className="px-2 py-10 text-center">
          <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-champagne/50">
            <span className="display text-3xl text-champagne">?</span>
          </div>
          <p className="mt-5 text-sm text-marfim-2">O nome está escondido, para ninguém ver por cima do ombro.</p>
          <button type="button" className="btn btn-ghost mt-5" onClick={toggleHide}>
            Mostrar quem eu tirei
          </button>
        </div>
      ) : (
        <div className="fade-in px-1 pb-2 pt-6 text-center">
          <div className="flex justify-center" aria-hidden>
            <Avatar name={receiver.name} src={receiver.avatar_url} size={120} ring />
          </div>
          <h2 className="display mt-5 text-[2.5rem] leading-[1.02]">{receiver.name}</h2>
        </div>
      )}

      {range && (
        <p className="mt-2 text-center text-sm text-marfim-2">
          Presente de <span className="numeral text-marfim">{range}</span>
        </p>
      )}

      <div className="rule my-5" />
      <h3 className="kicker mb-1">Lista de desejos</h3>

      {hidden ? (
        <p className="py-4 text-sm text-marfim-2">A lista aparece junto com o nome.</p>
      ) : listError ? (
        <p className="py-4 text-sm text-cereja" role="alert">{listError}</p>
      ) : items == null ? (
        <div className="space-y-3 py-4" aria-hidden>
          <div className="h-4 w-2/3 rounded bg-carvao-3" />
          <div className="h-4 w-1/2 rounded bg-carvao-3" />
          <div className="h-4 w-3/5 rounded bg-carvao-3" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-4 text-sm leading-relaxed text-marfim-2">
          Essa pessoa ainda não escreveu desejos. Vale um presente dentro da faixa.
        </p>
      ) : (
        <ul>
          {items.map((item) => {
            const link = storeLink(item.item_url);
            const bought = item.purchased === true;
            return (
              <li key={item.id} className={`flex items-start gap-3 border-t border-linha py-4 ${bought ? 'opacity-60' : ''}`}>
                <span className="pt-1"><Stars n={item.priority} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-marfim">{item.item_name}</p>
                  {item.item_description && (
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-marfim-2">{item.item_description}</p>
                  )}
                  {link && (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex min-h-11 max-w-full break-all items-center gap-1.5 text-sm text-marfim underline decoration-cereja underline-offset-4"
                    >
                      <ExternalLink size={15} strokeWidth={1.5} /> {link.domain}
                    </a>
                  )}
                </div>
                {typeof item.purchased === 'boolean' && (
                  <button
                    type="button"
                    onClick={() => void mark(item)}
                    disabled={busyId === item.id}
                    aria-pressed={bought}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1.5 px-1 text-sm text-marfim-2"
                  >
                    {bought && <Check size={15} strokeWidth={1.5} className="text-salvia" />}
                    {bought ? 'Comprado' : 'Já comprei'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
