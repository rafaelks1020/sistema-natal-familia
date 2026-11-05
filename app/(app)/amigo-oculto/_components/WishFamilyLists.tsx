'use client';

import { useEffect, useState } from 'react';
import Avatar from '@/app/ui/Avatar';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { WishItemRow, type WishDetail, type WishParticipant } from './WishHelpers';

interface WishListPayload {
  items: WishDetail[];
  config_id: number | null;
  participants?: WishParticipant[];
}

export default function WishFamilyLists({
  initialParticipantId,
}: {
  initialParticipantId?: number;
}) {
  const toast = useToast();
  const [participants, setParticipants] = useState<WishParticipant[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(initialParticipantId ?? null);
  const [items, setItems] = useState<WishDetail[] | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    let cancel = false;
    api<WishListPayload>('/api/wishlist')
      .then((res) => {
        if (cancel) return;
        const list = res.participants ?? [];
        setParticipants(list);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (selectedId == null) {
      setItems(null);
      return;
    }
    let cancel = false;
    setLoadingList(true);
    api<WishListPayload>(`/api/wishlist?participant_id=${selectedId}`)
      .then((res) => {
        if (!cancel) setItems(res.items);
      })
      .catch((err: Error) => {
        if (!cancel) toast(err.message, 'erro');
      })
      .finally(() => {
        if (!cancel) setLoadingList(false);
      });
    return () => {
      cancel = true;
    };
  }, [selectedId, toast]);

  async function togglePurchased(item: WishDetail) {
    if (typeof item.purchased !== 'boolean' || busyId != null) return;
    const next = !item.purchased;
    setBusyId(item.id);
    try {
      const saved = await api<WishDetail>(`/api/wishlist/${item.id}`, {
        method: 'PUT',
        json: { purchased: next },
      });
      setItems((prev) =>
        prev?.map((row) =>
          row.id === item.id
            ? { ...row, purchased: saved.purchased, purchased_by_me: saved.purchased_by_me }
            : row,
        ) ?? null,
      );
      toast(next ? 'Marcado como comprado' : 'Marcação removida');
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setBusyId(null);
    }
  }

  if (participants.length === 0 && initialParticipantId == null) return null;

  const selectedPerson = participants.find((p) => p.id === selectedId);

  return (
    <div className="mt-8 border-t border-linha pt-6">
      <p className="kicker mb-1">Presentes da família</p>
      <h3 className="display text-[1.45rem] leading-tight">Ver lista de outra pessoa</h3>
      <p className="mt-1 text-xs leading-relaxed text-marfim-3">
        Veja os desejos de um parente e marque o que já comprou. Quem ganha nunca vê as marcações.
      </p>

      {participants.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
          {participants.map((p) => {
            const active = selectedId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedId(active ? null : p.id)}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                  active
                    ? 'border-champagne bg-carvao-2 text-marfim'
                    : 'border-linha bg-carvao text-marfim-2'
                }`}
              >
                <Avatar name={p.name} src={p.avatar_url} size={22} />
                <span>{p.name}</span>
                {p.wish_count > 0 && (
                  <span className="numeral text-[11px] text-champagne">({p.wish_count})</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selectedId != null && (
        <div className="surface mt-3 px-4 py-4">
          {selectedPerson && (
            <p className="mb-2 text-xs text-champagne">
              Lista de <span className="text-marfim">{selectedPerson.name}</span>
            </p>
          )}
          {loadingList ? (
            <p className="py-4 text-sm text-marfim-3">Carregando desejos...</p>
          ) : !items || items.length === 0 ? (
            <p className="py-4 text-sm text-marfim-2">
              Esta pessoa ainda não anotou desejos na lista.
            </p>
          ) : (
            <ul>
              {items.map((item) => (
                <WishItemRow
                  key={item.id}
                  item={item}
                  owner={false}
                  busy={busyId === item.id}
                  onTogglePurchased={() => void togglePurchased(item)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
