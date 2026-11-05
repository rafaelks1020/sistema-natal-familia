// Conteúdos novos que podem ser denunciados. Cada tabela tem id, user_id (autor) e a coluna de texto.
// Nomes fixos combinados entre as partes das novidades; não renomear sem atualizar aqui.
export const ALVOS = {
  dica: { tabela: 'secret_santa_hints', texto: 'texto', rotulo: 'Dica do amigo oculto' },
  receita: { tabela: 'family_recipes', texto: 'titulo', rotulo: 'Receita' },
  historia: { tabela: 'family_stories', texto: 'titulo', rotulo: 'História' },
  advento: { tabela: 'advent_responses', texto: 'texto', rotulo: 'Resposta do Advento' },
  desafio: { tabela: 'party_photo_entries', texto: 'legenda', rotulo: 'Foto do desafio' },
  homenagem: { tabela: 'family_tributes', texto: 'texto', rotulo: 'Homenagem' },
  carona: { tabela: 'ride_offers', texto: 'observacao', rotulo: 'Carona ou hospedagem' },
  prato: { tabela: 'ceia_dishes', texto: 'nome', rotulo: 'Prato da ceia' },
  capsula: { tabela: 'time_capsules', texto: 'texto', rotulo: 'Mensagem da cápsula do tempo' },
} as const;

export type AlvoTipo = keyof typeof ALVOS;

export function alvoValido(tipo: unknown): tipo is AlvoTipo {
  return typeof tipo === 'string' && Object.prototype.hasOwnProperty.call(ALVOS, tipo);
}

export function alvoDe(tipo: unknown): (typeof ALVOS)[AlvoTipo] | null {
  return alvoValido(tipo) ? ALVOS[tipo] : null;
}
