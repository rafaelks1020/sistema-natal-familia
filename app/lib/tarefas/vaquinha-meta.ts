import { consultarMeta } from '@/app/api/vaquinha/meta';

export default async function tarefa(): Promise<string> {
  const result = await consultarMeta();
  return `Vaquinha: ${result.avisos} aviso(s) de meta agendado(s).`;
}
