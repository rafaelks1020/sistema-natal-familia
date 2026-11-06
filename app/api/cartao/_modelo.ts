// Constantes do cartão de Natal, usadas pelo servidor (imagem) e pela tela do site.
// Sem dependência de servidor: pode ser importado em componente cliente.

export const MODELOS = [
  { id: 'meia-noite', nome: 'Meia-Noite', descricao: 'Fundo carvão, moldura champagne' },
  { id: 'cereja', nome: 'Cereja', descricao: 'Faixas vermelhas e foto central' },
  { id: 'flash', nome: 'Flash', descricao: 'Foto em tela cheia' },
] as const;

export type ModeloId = (typeof MODELOS)[number]['id'];

export const MAX_TEXTO = 120;
export const MAX_ASSINATURA = 40;

export const FRASES = [
  'Feliz Natal! Que a nossa mesa seja sempre cheia de amor.',
  'Que o Natal una ainda mais a nossa família.',
  'Juntos, o Natal fica muito mais bonito.',
  'Paz, saúde e muita gente querida por perto.',
  'O melhor presente é ter vocês na ceia.',
];

export function modeloValido(v: unknown): v is ModeloId {
  return MODELOS.some((m) => m.id === v);
}

/** Monta a query da imagem; usada pelo site e igual à que o app monta. */
export function queryCartao(p: { foto: string; modelo: ModeloId; texto: string; assinatura: string; baixar?: boolean }): string {
  const q = new URLSearchParams({ foto: p.foto, modelo: p.modelo, texto: p.texto, assinatura: p.assinatura });
  if (p.baixar) q.set('baixar', '1');
  return q.toString();
}
