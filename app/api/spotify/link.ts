// Funções puras (sem banco, sem servidor) do plano B da playlist. Testadas em link.test.mjs.

export const LIMITE_PEDIDO = 120;

/** Aceita só https://open.spotify.com/playlist/<id> (com ou sem prefixo intl-xx). Devolve o link e o id. */
export function parseSpotifyLink(raw: unknown): { link: string; id: string } | null {
  if (typeof raw !== 'string') return null;
  let text = raw.trim();
  if (!text || text.length > 500) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = `https://${text}`;
  let url: URL;
  try { url = new URL(text); } catch { return null; }
  if (url.protocol !== 'https:' || url.hostname !== 'open.spotify.com' || url.port || url.username || url.password) return null;
  const match = /^\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?playlist\/([A-Za-z0-9]{10,40})\/?$/.exec(url.pathname);
  if (!match) return null;
  url.hash = '';
  return { link: url.href, id: match[1] };
}

/** Minúsculas, sem acento, espaços simples. */
export function normalizarTexto(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Hífen, meia-risca e travessão (pessoas colam textos com qualquer um deles) ou a palavra "por".
const SEPARADOR = new RegExp(` (?:-|${String.fromCharCode(0x2013)}|${String.fromCharCode(0x2014)}|por) `, 'i');

/** Separa "música - artista" ou "música por artista". Sem separador, o artista fica vazio. */
export function parsePedido(raw: unknown): { nome: string; artista: string; chave: string } | null {
  if (typeof raw !== 'string') return null;
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text || text.length > LIMITE_PEDIDO) return null;
  const separador = SEPARADOR.exec(text);
  let nome = text;
  let artista = '';
  if (separador) {
    const antes = text.slice(0, separador.index).trim();
    const depois = text.slice(separador.index + separador[0].length).trim();
    if (antes && depois) { nome = antes; artista = depois; }
  }
  return { nome, artista, chave: `pedido:${normalizarTexto(text)}` };
}
