'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import Stars from './Stars';
import { storeLink } from './format';
import { sortWishes, type WishItem } from './types';

const PRIORITY_LABEL = ['Seria legal', 'Quero', 'Quero muito'];

interface Draft {
  id: number | null;
  item_name: string;
  item_description: string;
  item_url: string;
  priority: number;
}

const EMPTY: Draft = { id: null, item_name: '', item_description: '', item_url: '', priority: 2 };

function Sheet({
  draft,
  onClose,
  onSaved,
  onDeleted,
}: {
  draft: Draft;
  onClose: () => void;
  onSaved: (item: WishItem) => void;
  onDeleted: (id: number) => void;
}) {
  const toast = useToast();
  const nameRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(draft);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [askDelete, setAskDelete] = useState(false);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError('');
    const name = form.item_name.trim();
    if (!name) {
      setError('Escreva o nome do presente.');
      return;
    }
    const link = form.item_url.trim();
    if (link && !storeLink(link)) {
      setError('O link precisa começar com https://');
      return;
    }
    const json = {
      item_name: name,
      item_description: form.item_description.trim(),
      item_url: link,
      priority: form.priority,
    };
    setBusy(true);
    try {
      const saved = form.id
        ? await api<WishItem>(`/api/wishlist/${form.id}`, { method: 'PUT', json })
        : await api<WishItem>('/api/wishlist', { method: 'POST', json });
      onSaved(saved);
      toast(form.id ? 'Desejo atualizado' : 'Desejo anotado');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!form.id) return;
    setBusy(true);
    try {
      await api(`/api/wishlist/${form.id}`, { method: 'DELETE' });
      onDeleted(form.id);
      toast('Desejo apagado');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center">
      <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/65" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="desejo-titulo"
        className="relative max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-[18px] border border-linha bg-carvao-2 px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4"
      >
        <div className="mx-auto mb-4 h-px w-10 bg-champagne/70" />
        <h3 id="desejo-titulo" className="display text-[1.7rem]">
          {form.id ? 'Editar desejo' : 'Novo desejo'}
        </h3>
        <form onSubmit={save} className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs text-marfim-3">Nome do presente</span>
            <input
              ref={nameRef}
              className="field"
              value={form.item_name}
              maxLength={120}
              onChange={(e) => setForm((f) => ({ ...f, item_name: e.target.value }))}
              placeholder="Ex.: livro de receitas"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-marfim-3">Um detalhe (opcional)</span>
            <textarea
              className="field min-h-24 resize-none"
              value={form.item_description}
              maxLength={400}
              rows={3}
              onChange={(e) => setForm((f) => ({ ...f, item_description: e.target.value }))}
              placeholder="Cor, tamanho, onde encontrar"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-marfim-3">Link (opcional)</span>
            <input
              className="field"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              value={form.item_url}
              maxLength={500}
              onChange={(e) => setForm((f) => ({ ...f, item_url: e.target.value }))}
              placeholder="https://"
            />
          </label>
          <fieldset>
            <legend className="mb-1.5 text-xs text-marfim-3">Quanto você quer</legend>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={form.priority === n}
                  onClick={() => setForm((f) => ({ ...f, priority: n }))}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-[14px] border px-1 text-xs ${
                    form.priority === n ? 'border-champagne text-marfim' : 'border-linha text-marfim-3'
                  }`}
                >
                  <Stars n={n} />
                  {PRIORITY_LABEL[n - 1]}
                </button>
              ))}
            </div>
          </fieldset>
          {error && <p role="alert" className="text-sm text-cereja">{error}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? 'Um instante…' : 'Salvar'}
          </button>
          <button type="button" className="btn btn-ghost w-full" disabled={busy} onClick={onClose}>
            Fechar
          </button>
        </form>
        {form.id && (
          <div className="mt-2 border-t border-linha pt-3">
            {askDelete ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-marfim-2">Apagar este desejo?</p>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => setAskDelete(false)}>Não</button>
                  <button type="button" className="btn btn-quiet text-cereja" disabled={busy} onClick={() => void remove()}>Apagar</button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn btn-quiet text-marfim-3" onClick={() => setAskDelete(true)}>
                <Trash2 size={16} strokeWidth={1.5} /> Apagar este desejo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyWishes({
  items,
  canWrite,
  blockedReason,
  onChange,
}: {
  items: WishItem[];
  canWrite: boolean;
  blockedReason: string | null;
  onChange: (items: WishItem[]) => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const toast = useToast();

  async function remove(id: number) {
    setBusyId(id);
    try {
      await api(`/api/wishlist/${id}`, { method: 'DELETE' });
      onChange(items.filter((item) => item.id !== id));
      setConfirmId(null);
      toast('Desejo apagado');
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="display text-[1.85rem] leading-[1.05]">
          Minha lista
          <br />
          de desejos
        </h2>
        {canWrite && (
          <button type="button" className="btn btn-primary mb-1 shrink-0 px-4" onClick={() => setDraft({ ...EMPTY })}>
            <Plus size={18} strokeWidth={1.5} /> Novo
          </button>
        )}
      </div>
      <p className="mb-2 text-sm leading-relaxed text-marfim-2">
        Quem for te presentear vê esta lista. Se alguém já comprou, você não fica sabendo.
      </p>

      {blockedReason && <p className="text-sm text-marfim-3">{blockedReason}</p>}

      {items.length === 0 && canWrite && (
        <p className="py-6 text-sm text-marfim-2">Nenhum desejo ainda. Toque em Novo e conte o que te faria sorrir.</p>
      )}

      {items.length > 0 && (
        <ul>
          {items.map((item) => {
            const link = storeLink(item.item_url);
            return (
            <li key={item.id} className="flex items-start gap-2 border-t border-linha py-3">
              <span className="pt-1"><Stars n={item.priority} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-marfim">{item.item_name}</p>
                {item.item_description && (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-marfim-2">{item.item_description}</p>
                )}
                {link && (
                  <a href={link.href} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-11 max-w-full items-center break-all text-sm text-marfim underline decoration-cereja underline-offset-4">
                    {link.domain}
                  </a>
                )}
              </div>
              {confirmId === item.id ? (
                <div className="flex shrink-0 items-center">
                  <button type="button" className="btn btn-quiet" disabled={busyId === item.id} onClick={() => setConfirmId(null)}>Não</button>
                  <button type="button" className="btn btn-quiet text-cereja" disabled={busyId === item.id} onClick={() => void remove(item.id)}>Apagar</button>
                </div>
              ) : (
                <div className="flex shrink-0">
                  <button
                    type="button"
                    aria-label={`Editar ${item.item_name}`}
                    className="flex h-11 w-11 items-center justify-center text-marfim-2"
                    onClick={() => setDraft({
                      id: item.id,
                      item_name: item.item_name,
                      item_description: item.item_description ?? '',
                      item_url: item.item_url ?? '',
                      priority: item.priority,
                    })}
                  >
                    <Pencil size={18} strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Apagar ${item.item_name}`}
                    className="flex h-11 w-11 items-center justify-center text-marfim-3"
                    onClick={() => setConfirmId(item.id)}
                  >
                    <Trash2 size={18} strokeWidth={1.5} />
                  </button>
                </div>
              )}
            </li>
          );
          })}
        </ul>
      )}

      {draft && (
        <Sheet
          draft={draft}
          onClose={() => setDraft(null)}
          onSaved={(saved) => {
            const next = draft.id
              ? items.map((item) => (item.id === saved.id ? saved : item))
              : [saved, ...items];
            onChange(sortWishes(next));
            setDraft(null);
          }}
          onDeleted={(id) => {
            onChange(items.filter((item) => item.id !== id));
            setDraft(null);
          }}
        />
      )}
    </section>
  );
}
