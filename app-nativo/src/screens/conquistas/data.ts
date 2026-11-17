import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import { useSession } from '../../session';

export interface ConquistaPerfil { id: string; nome: string; descricao: string; conquistado: boolean }
export interface ConquistasDados {
  ano: number;
  user_id: number;
  conquistas: ConquistaPerfil[];
}
// A API ainda devolve a lista no campo antigo (selos); a tela só vê "conquistas".
export function useConquistas(id?: number) {
  const { user, status } = useSession();
  return useQuery({
    queryKey: ['conquistas-g', user?.id, id ?? 'eu'],
    enabled: status === 'authenticated' && (id === undefined || id > 0),
    queryFn: async ({ signal }): Promise<ConquistasDados> => {
      const bruto = await api<Record<string, unknown>>(`/api/conquistas${id === undefined ? '' : `?user_id=${id}`}`, { signal });
      const lista = bruto.selos;
      return { ano: Number(bruto.ano), user_id: Number(bruto.user_id), conquistas: Array.isArray(lista) ? lista as ConquistaPerfil[] : [] };
    },
  });
}
