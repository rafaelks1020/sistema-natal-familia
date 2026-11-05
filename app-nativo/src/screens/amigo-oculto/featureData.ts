import { useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, queryClient, sessionStore } from '../../api';
import { useToast } from '../../ui/Toast';
import { assertSession, sameSession } from './data';
export interface ThemeData { tema: string; valor_centavos: number | null; evitar_repeticao: boolean }
export interface HintData { hints: { id: number; texto: string; created_at: string }[]; participants: { id: number; name: string }[]; guess: number | null; can_send: boolean }
export interface HistoryData { history: { ano: number; giver: string; receiver: string }[] }
export interface LivePair { giver_id: number; receiver_id: number; giver: string; receiver: string; acertos: string[] }
export interface LiveData { live: { atual: number; total: number; iniciado_em: string; encerrado_em: string | null; pairs: LivePair[] } | null }
export const featureKeys = {
  all: ['amigo-oculto', 'features'] as const,
  theme: ['amigo-oculto', 'features', 'theme'] as const,
  hints: ['amigo-oculto', 'features', 'hints'] as const,
  history: ['amigo-oculto', 'features', 'history'] as const,
  live: ['amigo-oculto', 'features', 'live'] as const,
};
export const temas = ['Livre', 'Até R$ 50', 'Feito à mão', 'Só livro', 'Brechó', 'Coisa de cozinha', 'Pior presente'];
type Operation = { path: string; method: 'POST' | 'PUT' | 'DELETE'; json: unknown; message?: string; onSuccess?: () => void; generation: number };
export function useFeatureMutation() {
  const toast = useToast();
  const saving = useRef(false);
  const mutation = useMutation({
    mutationFn: async (op: Operation) => { assertSession(op.generation); return api(op.path, { method: op.method, json: op.json }); },
    onMutate: async op => { await queryClient.cancelQueries({ queryKey: featureKeys.all }); assertSession(op.generation); },
    onSuccess: (_data, op) => { if (!sameSession(op.generation)) return; if (op.message) toast(op.message); op.onSuccess?.(); },
    onError: (error, op) => { if (sameSession(op.generation)) toast(error.message, 'error'); },
    onSettled: (_data, _error, op) => { saving.current = false; if (sameSession(op.generation)) void queryClient.invalidateQueries({ queryKey: featureKeys.all }); },
  });
  return { ...mutation, send: (op: Omit<Operation, 'generation'>) => { if (!saving.current) { saving.current = true; mutation.mutate({ ...op, generation: sessionStore.getGeneration() }); } } };
}
