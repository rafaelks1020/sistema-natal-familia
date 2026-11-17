import type { SugestaoPontos } from '../../types/pontos';

/** Frase curta que diz em que pé está cada jeito de ganhar pontos. */
export function situacaoSugestao(s: SugestaoPontos): { texto: string; completo: boolean } {
  const resta = Math.max(0, s.limite - s.feitos);
  const vezes = (n: number) => (n === 1 ? '1 vez' : `${n} vezes`);
  if (s.periodo === 'dia') {
    if (resta === 0) return { completo: true, texto: s.limite === 1 ? 'Feito hoje. Amanhã vale de novo.' : `Feito ${vezes(s.limite)} hoje. Amanhã vale de novo.` };
    if (s.feitos <= 0) return { completo: false, texto: s.limite === 1 ? 'Vale uma vez por dia.' : `Vale até ${vezes(s.limite)} por dia.` };
    return { completo: false, texto: `Já fez ${vezes(s.feitos)} hoje. Ainda vale mais ${vezes(resta)}.` };
  }
  if (resta === 0) return { completo: true, texto: s.limite === 1 ? 'Feito.' : `Feito ${vezes(s.limite)}. Completo.` };
  if (s.feitos <= 0) return { completo: false, texto: s.limite === 1 ? 'Vale uma vez.' : `Vale até ${vezes(s.limite)}.` };
  return { completo: false, texto: `Já fez ${vezes(s.feitos)}. Ainda vale mais ${vezes(resta)}.` };
}

/** As primeiras sugestões que ainda valem pontos (cartão do início). */
export function proximasSugestoes(sugestoes: readonly SugestaoPontos[] | undefined, quantas: number): SugestaoPontos[] {
  return (sugestoes ?? []).filter((s) => s.feitos < s.limite).slice(0, quantas);
}

/** "1 ponto", "5 pontos", "1.008 pontos". */
export function textoPontos(n: number): string {
  return `${n.toLocaleString('pt-BR')} ${Math.abs(n) === 1 ? 'ponto' : 'pontos'}`;
}

/** "+1 ponto", "+5 pontos". */
export function maisPontos(n: number): string {
  return `+${textoPontos(n)}`;
}

const formatoDataHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
export function dataHoraSP(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : formatoDataHora.format(d);
}

const formatoDataHoraCurta = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
/** "24/12/2026 18:00" no horário de Brasília. */
export function dataHoraCurtaSP(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : formatoDataHoraCurta.format(d).replace(',', '');
}
