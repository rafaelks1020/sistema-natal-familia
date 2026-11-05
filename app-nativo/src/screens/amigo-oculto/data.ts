import { useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, ApiError, queryClient, sessionStore } from '../../api';
import type { WishFields, WishItem, WishlistData } from '../../types/amigo-oculto';
import { useToast } from '../../ui/Toast';

export const santaKeys = {
  all: ['amigo-oculto'] as const,
  draw: ['amigo-oculto', 'draw'] as const,
  admin: ['amigo-oculto', 'admin'] as const,
  wishlist: (participantId?: number, configId?: number) =>
    ['amigo-oculto', 'wishlist', participantId ?? 'mine', configId ?? 'current'] as const,
};

export function sameSession(generation: number) {
  return generation === sessionStore.getGeneration() && sessionStore.getSnapshot().status === 'authenticated';
}

export function assertSession(generation: number) {
  if (!sameSession(generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
}

export const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function revealDateLabel(value: string | null) {
  if (!value) return 'data a confirmar';
  const [, month, day] = value.split('-');
  return `${day} de ${months[Number(month) - 1] ?? ''}`;
}

type WishChange =
  | { kind: 'create'; fields: WishFields }
  | { kind: 'edit'; id: number; fields: WishFields }
  | { kind: 'delete'; id: number }
  | { kind: 'purchase'; id: number; purchased: boolean };
type WishOperation = WishChange & { generation: number; optimisticId: number };

function sortWishes(items: WishItem[]) {
  return [...items].sort((a, b) => b.priority - a.priority || a.created_at.localeCompare(b.created_at) || a.id - b.id);
}

export function useWishlist(participantId?: number, configId?: number) {
  const key = santaKeys.wishlist(participantId, configId);
  const toast = useToast();
  const saving = useRef(false);
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api<WishlistData>(participantId === undefined ? '/api/wishlist' : `/api/wishlist?participant_id=${participantId}`, { signal }),
  });
  const mutation = useMutation({
    mutationFn: async (operation: WishOperation): Promise<WishItem | { ok: true }> => {
      assertSession(operation.generation);
      if (operation.kind === 'create') return api<WishItem>('/api/wishlist', { method: 'POST', json: operation.fields });
      if (operation.kind === 'delete') return api<{ ok: true }>(`/api/wishlist/${operation.id}`, { method: 'DELETE' });
      return api<WishItem>(`/api/wishlist/${operation.id}`, {
        method: 'PUT', json: operation.kind === 'purchase' ? { purchased: operation.purchased } : operation.fields,
      });
    },
    onMutate: async operation => {
      await queryClient.cancelQueries({ queryKey: key });
      assertSession(operation.generation);
      const previous = queryClient.getQueryData<WishlistData>(key);
      if (previous) {
        let items = previous.items;
        if (operation.kind === 'create') {
          items = [...items, { ...operation.fields, id: operation.optimisticId, created_at: new Date().toISOString() }];
        } else if (operation.kind === 'delete') items = items.filter(item => item.id !== operation.id);
        else items = items.map(item => item.id !== operation.id ? item : operation.kind === 'edit'
          ? { ...item, ...operation.fields } : { ...item, purchased: operation.purchased });
        queryClient.setQueryData<WishlistData>(key, { ...previous, items: sortWishes(items) });
      }
      return { previous };
    },
    onError: (error, operation, context) => {
      if (!sameSession(operation.generation)) return;
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast(error.message, 'error');
    },
    onSuccess: (result, operation) => {
      if (!sameSession(operation.generation)) return;
      if ('id' in result) queryClient.setQueryData<WishlistData>(key, current => current ? {
        ...current, items: sortWishes(current.items.map(item => item.id === (operation.kind === 'create' ? operation.optimisticId : result.id) ? result : item)),
      } : current);
      if (operation.kind !== 'purchase') toast(operation.kind === 'delete' ? 'Desejo apagado.' : 'Desejo salvo com carinho.');
    },
    onSettled: (_data, _error, operation) => {
      saving.current = false;
      if (sameSession(operation.generation)) void queryClient.invalidateQueries({ queryKey: key });
    },
  });

  async function change(operation: WishChange) {
    if (saving.current) return false;
    saving.current = true;
    const generation = sessionStore.getGeneration();
    try {
      await mutation.mutateAsync({ ...operation, generation, optimisticId: -Date.now() });
      return sameSession(generation);
    } catch { return false; }
    finally { saving.current = false; }
  }
  return { query, change, pending: mutation.isPending };
}
