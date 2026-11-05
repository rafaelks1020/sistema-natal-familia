import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, sessionStore } from '../../api';
import { useSession } from '../../session';
import { enviarFoto, type FotoLocal } from '../../upload';
import { useToast } from '../../ui/Toast';
export interface Challenge { id: number; ano: number; titulo: string; aberto: boolean; encerrado_em: string | null; created_at: string }
export interface Entry { id: number; desafio_id: number; user_id: number; image_url: string; legenda: string; created_at: string; name: string; avatar_url: string | null; votos: number; vencedor: boolean }
export interface ChallengeData { ano: number; me: { id: number; is_admin: boolean }; desafios: Challenge[]; fotos: Entry[]; meusVotos: { desafio_id: number; entry_id: number }[] }
export interface OfficialPhoto { id: number; ano: number; image_url: string; legenda: string; dica_pose: string; created_at: string }
export interface OfficialData { ano: number; is_admin: boolean; fotos: OfficialPhoto[] }
export const festaKeys = { root: ['festa-i1'] as const, challenge: (id?: number) => ['festa-i1', 'desafio', id] as const, official: (id?: number) => ['festa-i1', 'foto-oficial', id] as const };
export const challengePath = '/api/festa/desafio';
export const officialPath = '/api/festa/foto-oficial';
export function useChallenges() {
  const { user, status } = useSession();
  return useQuery({ queryKey: festaKeys.challenge(user?.id), queryFn: ({ signal }) => api<ChallengeData>(challengePath, { signal }), enabled: status === 'authenticated', refetchInterval: 10000 });
}
export function useOfficialPhotos() {
  const { user, status } = useSession();
  return useQuery({ queryKey: festaKeys.official(user?.id), queryFn: ({ signal }) => api<OfficialData>(officialPath, { signal }), enabled: status === 'authenticated' });
}
type Write<T> = { method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'; json?: Record<string, unknown>; foto?: FotoLocal; success: string; generation?: number; optimistic?: (previous: T) => T };
export function useFestaMutation<T>(path: string, queryKey: readonly unknown[]) {
  const cache = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async (input: Write<T>) => {
      const generation = input.generation;
      if (generation === undefined || generation !== sessionStore.getGeneration() || sessionStore.getSnapshot().status !== 'authenticated') throw new Error('Entre novamente para continuar.');
      const image_url = input.foto ? await enviarFoto(input.foto) : undefined;
      if (generation !== sessionStore.getGeneration() || sessionStore.getSnapshot().status !== 'authenticated') throw new Error('Sua sessão mudou. Tente novamente.');
      await api(path, { method: input.method, json: image_url ? { ...input.json, image_url } : input.json });
      return { generation };
    },
    onMutate: async (input) => {
      const generation = sessionStore.getGeneration();
      input.generation = generation;
      await cache.cancelQueries({ queryKey });
      const previous = cache.getQueryData<T>(queryKey);
      if (previous && input.optimistic && generation === sessionStore.getGeneration() && sessionStore.getSnapshot().status === 'authenticated') cache.setQueryData<T>(queryKey, input.optimistic(previous));
      return { previous, generation };
    },
    onSuccess: ({ generation }, input) => {
      if (generation !== sessionStore.getGeneration() || sessionStore.getSnapshot().status !== 'authenticated') return;
      toast(input.success);
    },
    onError: (error, _input, context) => {
      if (context?.generation !== sessionStore.getGeneration() || sessionStore.getSnapshot().status !== 'authenticated') return;
      if (context.previous) cache.setQueryData(queryKey, context.previous);
      toast(error.message, 'error');
    },
    onSettled: (_data, _error, _input, context) => {
      if (context?.generation === sessionStore.getGeneration() && sessionStore.getSnapshot().status === 'authenticated') void cache.invalidateQueries({ queryKey });
    },
  });
}
