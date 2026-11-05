// Edição do Natal: o ano da ceia a que o conteúdo pertence.
// Janeiro e fevereiro ainda são da edição anterior (retrospectiva, fotos da ceia).
export function edicaoAtual(agora = new Date()): number {
  const sp = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const ano = sp.getFullYear();
  return sp.getMonth() < 2 ? ano - 1 : ano;
}

/** Data de hoje em São Paulo, AAAA-MM-DD. */
export function hojeSP(agora = new Date()): string {
  return agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}
