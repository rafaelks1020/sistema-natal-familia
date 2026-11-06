import { reordenarPendentes } from '@/app/api/spotify/_service';

/** Termina a reordenação das playlists por votos que ficou esperando o intervalo de 30 s. */
export default async function tarefa(): Promise<string> {
  const feitas = await reordenarPendentes();
  return feitas ? `${feitas} playlist(s) reordenada(s) pelos votos` : 'nenhuma playlist pendente';
}
