import { useRef } from 'react';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { sessionStore } from '../../api';
import { useToast } from '../../ui/Toast';

export const tipos = ['carona_oferta', 'carona_pedido', 'hospedagem_oferta', 'hospedagem_pedido'] as const;
export type Tipo = typeof tipos[number];
export const rotulos: Record<Tipo, string> = { carona_oferta: 'Ofereço carona', carona_pedido: 'Preciso de carona', hospedagem_oferta: 'Ofereço hospedagem', hospedagem_pedido: 'Preciso de hospedagem' };
export interface Oferta {
  id: number; user_id: number; name: string; avatar_url: string | null; tipo: Tipo;
  origem: string; quando: string; vagas: number; observacao: string; telefone: string | null;
  ativo: boolean; minha_reserva: number; reservas: { user_id: number; name: string; quantidade: number }[];
}
export interface CaronasData { ano: number; ofertas: Oferta[] }
export const caronasKey = ['caronas', 'edicao'] as const;
export const vigente = (generation: number) => sessionStore.getSnapshot().status === 'authenticated' && sessionStore.getGeneration() === generation;

// O servidor confirma saldos e disponibilidade antes de atualizar a interface.
export function useEscritaParte(key: QueryKey) {
  const client = useQueryClient();
  const toast = useToast();
  const lock = useRef(false);
  const mutation = useMutation({
    mutationFn: async ({ action, generation }: { action: (generation: number) => Promise<unknown>; generation: number; depois?: () => void }) => {
      if (!vigente(generation)) throw new Error('Sua sessão mudou. Entre novamente.');
      return action(generation);
    },
    onMutate: async ({ generation }) => {
      await client.cancelQueries({ queryKey: key });
      return { generation };
    },
    onSuccess: async (_result, variables) => {
      if (!vigente(variables.generation)) return;
      toast('Pronto, atualizado.'); variables.depois?.();
    },
    onError: (error, variables) => { if (vigente(variables.generation)) toast(error.message, 'error'); },
    onSettled: async (_data, _error, variables) => {
      try { if (vigente(variables.generation)) await client.invalidateQueries({ queryKey: key }); }
      finally { lock.current = false; }
    },
  });
  return {
    busy: mutation.isPending,
    executar: (action: (generation: number) => Promise<unknown>, depois?: () => void) => {
      if (lock.current) return;
      lock.current = true;
      mutation.mutate({ action, depois, generation: sessionStore.getGeneration() });
    },
  };
}
