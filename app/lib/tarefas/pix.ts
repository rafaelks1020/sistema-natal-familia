import { c6Configurado } from '@/app/lib/c6';
import { conferirAbertos } from '@/app/lib/pagamentos';

export default async function tarefa(): Promise<string> {
  if (!c6Configurado()) return 'C6 não configurado';
  const r = await conferirAbertos();
  return `${r.verificados} conferidos, ${r.baixados} baixados`;
}
