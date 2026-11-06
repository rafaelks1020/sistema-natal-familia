import { enviarVencidos } from '@/app/lib/admin/avisos';

export default async function tarefa(): Promise<string> {
  return enviarVencidos();
}
