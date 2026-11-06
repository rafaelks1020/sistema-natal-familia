// Dados da contagem regressiva compartilhados entre o app e os widgets.
export const APP_GROUP = 'group.br.com.natalemfamilia.app';
export const CHAVE_DATA = 'widget.event_date';
export const CHAVE_TITULO = 'widget.event_title';
export const TITULO_PADRAO = 'Natal em Família';

export type Contagem = { titulo: string; dias: number; horas: number; semData: boolean };

export function calcularContagem(data: string | null, titulo: string | null, agora = Date.now()): Contagem {
  const alvo = data ? new Date(data).getTime() : NaN;
  const nome = titulo && titulo.trim() ? titulo.trim() : TITULO_PADRAO;
  if (!Number.isFinite(alvo)) return { titulo: TITULO_PADRAO, dias: 0, horas: 0, semData: true };
  const falta = Math.max(0, alvo - agora);
  const totalHoras = Math.floor(falta / 3_600_000);
  return { titulo: nome, dias: Math.floor(totalHoras / 24), horas: totalHoras % 24, semData: false };
}
