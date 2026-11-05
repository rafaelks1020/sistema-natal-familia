import { useRef } from 'react';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { sessionStore } from '../../api';
import { useToast } from '../../ui/Toast';

function vigente(generation: number) {
  return sessionStore.getSnapshot().status === 'authenticated' && sessionStore.getGeneration() === generation;
}

export function useEscrita(key: QueryKey) {
  const client = useQueryClient();
  const toast = useToast();
  const lock = useRef(false);
  const mutation = useMutation({
    mutationFn: async ({ action, generation }: { action: () => Promise<unknown>; generation: number; depois?: () => void }) => {
      if (!vigente(generation)) throw new Error('Sua sessão mudou. Entre novamente.');
      return action();
    },
    onMutate: () => client.cancelQueries({ queryKey: key }),
    onSuccess: (_result, vars) => { if (vigente(vars.generation)) { toast('Pronto, atualizado.'); vars.depois?.(); } },
    onError: (error, vars) => { if (vigente(vars.generation)) toast(error.message, 'error'); },
    onSettled: async (_data, _error, vars) => {
      try { if (vigente(vars.generation)) await client.invalidateQueries({ queryKey: key }); }
      finally { lock.current = false; }
    },
  });
  return {
    busy: mutation.isPending,
    executar: (action: () => Promise<unknown>, depois?: () => void) => {
      if (lock.current) return;
      lock.current = true;
      mutation.mutate({ action, generation: sessionStore.getGeneration(), depois });
    },
  };
}
