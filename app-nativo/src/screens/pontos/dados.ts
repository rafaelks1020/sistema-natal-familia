import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import { useSession } from '../../session';
import type { PainelMissoes, PainelPontos } from '../../types/pontos';

export function usePontos() {
  const { user, status } = useSession();
  return useQuery({
    queryKey: ['pontos', user?.id],
    enabled: status === 'authenticated',
    staleTime: 60_000,
    queryFn: ({ signal }) => api<PainelPontos>('/api/pontos', { signal }),
  });
}

export function useMissoes() {
  const { user, status } = useSession();
  return useQuery({
    queryKey: ['missoes', user?.id],
    enabled: status === 'authenticated',
    staleTime: 60_000,
    queryFn: ({ signal }) => api<PainelMissoes>('/api/missoes', { signal }),
  });
}
