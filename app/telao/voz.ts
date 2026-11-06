// Comandos de voz do telão: texto reconhecido -> ação. Funções puras, sem DOM, testadas em voz.test.mjs.

export type CenaVoz = 'fotos' | 'tocando' | 'contagem' | 'recados' | 'advento';

export type AcaoVoz =
  | { tipo: 'proxima' }
  | { tipo: 'volta' }
  | { tipo: 'pausa' }
  | { tipo: 'continua' }
  | { tipo: 'ciclo' }
  | { tipo: 'cena'; cena: CenaVoz }
  | { tipo: 'placar' }
  | { tipo: 'presentes' }
  | { tipo: 'ajuda' };

/** Minúsculas, sem acento, sem pontuação, espaços únicos. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ATIVACAO = /\b(natal|natau|nathal)\b/;
const VERBO_MOSTRAR = /\b(mostra|mostre|mostrar|exibe|exiba|abre|abra|coloca|coloque|ver|veja|quero|vai para|vai pra|ir para|ir pra|volta para|volta pra|voltar para|voltar pra)\b/;

const CENAS: ReadonlyArray<[CenaVoz, RegExp]> = [
  ['contagem', /\b(quanto falta|falta quanto|contagem|relogio|ceia|meia noite|cronometro)\b/],
  ['tocando', /\b(musica|musicas|tocando|spotify|cancao|playlist)\b/],
  ['fotos', /\b(foto|fotos|imagem|imagens|slideshow|album)\b/],
  ['recados', /\b(recado|recados|mural|mensagem|mensagens)\b/],
  ['advento', /\b(advento|janela|calendario)\b/],
];

function cenaDe(frase: string): CenaVoz | null {
  for (const [cena, regra] of CENAS) if (regra.test(frase)) return cena;
  return null;
}

/**
 * Interpreta o que foi ouvido. Só vale se a palavra de ativação "Natal" aparecer; o que vem depois dela é o comando.
 * Devolve null quando não há ativação ou não entendeu o pedido.
 */
export function interpretarVoz(texto: string): AcaoVoz | null {
  const frase = normalizar(texto);
  const achou = ATIVACAO.exec(frase);
  if (!achou) return null;
  const pedido = frase.slice(achou.index + achou[0].length).trim();
  if (!pedido) return null;

  if (/\b(quem esta aqui|quem ta aqui|quem chegou|quem veio|quem ja chegou|presentes|convidados)\b/.test(pedido)) return { tipo: 'presentes' };
  if (/\b(placar|pontuacao|ranking|classificacao|pontos|quiz|podio)\b/.test(pedido)) return { tipo: 'placar' };
  if (/\b(automatico|automatica|ciclo|normal|tudo de novo|modo padrao)\b/.test(pedido)) return { tipo: 'ciclo' };
  if (/\b(ajuda|comandos|o que voce faz|o que voce sabe)\b/.test(pedido)) return { tipo: 'ajuda' };

  const cena = cenaDe(pedido);
  if (cena && (VERBO_MOSTRAR.test(pedido) || !/\b(proxima|proximo|volta|voltar|pausa|pausar|continua|continuar)\b/.test(pedido))) return { tipo: 'cena', cena };

  if (/\b(pausa|pausar|pause|pare|parar|congela|segura|espera)\b/.test(pedido) || pedido === 'para') return { tipo: 'pausa' };
  if (/\b(continua|continuar|continue|retoma|retomar|segue|seguir|play|solta|despausa)\b/.test(pedido)) return { tipo: 'continua' };
  if (/\b(proxima|proximo|avanca|avancar|passa|passar|pula|pular|seguinte|outra|outro)\b/.test(pedido)) return { tipo: 'proxima' };
  if (/\b(volta|voltar|anterior|retorna|retornar|de volta)\b/.test(pedido)) return { tipo: 'volta' };
  return null;
}

/** Duração em português falado: "3 dias, 4 horas e 5 minutos". */
export function falarDuracao(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const dias = Math.floor(total / 86400);
  const horas = Math.floor((total % 86400) / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;
  const partes: string[] = [];
  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
  if (dias) partes.push(plural(dias, 'dia', 'dias'));
  if (horas) partes.push(plural(horas, 'hora', 'horas'));
  if (minutos && dias === 0) partes.push(plural(minutos, 'minuto', 'minutos'));
  if (!dias && !horas && (segundos || !minutos)) partes.push(plural(segundos, 'segundo', 'segundos'));
  if (partes.length === 0) return '0 segundos';
  if (partes.length === 1) return partes[0];
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
}

/** Lista de nomes falada: "Ana, Bia e Caio". */
export function falarLista(nomes: string[]): string {
  if (nomes.length <= 1) return nomes.join('');
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}
