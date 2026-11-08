import { executarCicloGamificacao } from '@/app/lib/gamificacao/motor';

export default async function tarefa(): Promise<string> {
  return executarCicloGamificacao();
}
