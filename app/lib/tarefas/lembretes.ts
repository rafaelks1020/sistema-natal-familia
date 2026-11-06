import { query } from '@/app/lib/db';
import { hojeSP } from '@/app/lib/edicao';
import { enviarLembrete, montarFicha, type MotivoLembrete } from '@/app/lib/lembretes';
import { diasAte } from './contagem';

// Ficha de lembrete automática: a partir de 30 dias antes da ceia, 1 vez a cada 7 dias
// por pessoa e por motivo; nos últimos 3 dias, todo dia. Só quem ainda deve a resposta.
export default async function tarefa(): Promise<string> {
  const hoje = hojeSP();
  const { rows } = await query<{ value: string }>("SELECT value FROM app_settings WHERE key = 'event_date'");
  const dias = rows[0]?.value ? diasAte(rows[0].value, hoje) : null;
  if (dias === null || dias < 1 || dias > 30) return 'Lembretes: fora da janela de 30 dias.';
  const intervaloDias = dias <= 3 ? 1 : 7;
  const ficha = await montarFicha();
  const partes: string[] = [];
  for (const motivo of ['presenca', 'vaquinha'] as MotivoLembrete[]) {
    const r = await enviarLembrete(motivo, { intervaloDias, ficha });
    partes.push(`${motivo} ${r.enviados}/${r.elegiveis}`);
  }
  return `Lembretes (faltam ${dias}d): ${partes.join(', ')}.`;
}
