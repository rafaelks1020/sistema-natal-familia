import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import { useSession } from '../../session';

export interface Selo { id: string; nome: string; descricao: string; conquistado: boolean }
export interface ConquistasDados {
  ano: number;
  user_id: number;
  selos: Selo[];
  ranking: { id: string; titulo: string; pessoas: { id: number; nome: string; avatar_url: string | null; total: number }[] }[];
}
export function useConquistas(id?: number) {
  const { user, status } = useSession();
  return useQuery({
    queryKey: ['conquistas-g', user?.id, id ?? 'eu'],
    enabled: status === 'authenticated' && (id === undefined || id > 0),
    queryFn: ({ signal }) => api<ConquistasDados>(`/api/conquistas${id === undefined ? '' : `?user_id=${id}`}`, { signal }),
  });
}
