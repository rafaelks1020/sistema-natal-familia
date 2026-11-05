'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { sortWishes } from './types';
import WishFamilyLists from './WishFamilyLists';
import {
  draftFromWish,
  EMPTY_DRAFT,
  WishItemRow,
  type WishDetail,
  type WishDraft,
} from './WishHelpers';
import WishSheet from './WishSheet';

export default function MyWishes({
  items,
  canWrite,
  blockedReason,
  onChange,
}: {
  items: WishDetail[];
  canWrite: boolean;
  blockedReason: string | null;
  onChange: (items: WishDetail[]) => void;
}) {
  const [draft, setDraft] = useState<WishDraft | null>(null);
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
          <button
            type="button"
            className="btn btn-primary mb-1 shrink-0 px-4"
            onClick={() => setDraft({ ...EMPTY_DRAFT })}
          >
            <Plus size={18} strokeWidth={1.5} /> Novo
          </button>
        )}
      </div>
      <p className="mb-2 text-sm leading-relaxed text-marfim-2">
        Quem for te presentear vê esta lista. Se alguém já comprou, você não fica sabendo.
      </p>

      {blockedReason && <p className="text-sm text-marfim-3">{blockedReason}</p>}

      {items.length === 0 && canWrite && (
        <p className="py-6 text-sm text-marfim-2">
          Nenhum desejo ainda. Toque em Novo e conte o que te faria sorrir.
        </p>
      )}

      {items.length > 0 && (
        <ul>
          {items.map((item) => (
            <WishItemRow
              key={item.id}
              item={item}
              owner
              confirmDelete={confirmId === item.id}
              busy={busyId === item.id}
              onEdit={() => setDraft(draftFromWish(item))}
              onAskDelete={() => setConfirmId(item.id)}
              onCancelDelete={() => setConfirmId(null)}
              onConfirmDelete={() => void remove(item.id)}
            />
          ))}
        </ul>
      )}

      <WishFamilyLists />

      {draft && (
        <WishSheet
          draft={draft}
          onClose={() => setDraft(null)}
          onSaved={(saved) => {
            const next = draft.id
              ? items.map((item) => (item.id === saved.id ? saved : item))
              : [saved, ...items];
            onChange(sortWishes(next) as WishDetail[]);
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
