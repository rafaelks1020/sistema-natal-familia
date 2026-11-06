// Fontes do cartão no servidor. O layout usa next/font/google (sem arquivo acessível),
// então buscamos o TTF no Google Fonts e guardamos em memória (uma vez por instância).

interface Fonte {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 700;
  style: 'normal' | 'italic';
}

const DEFINICOES: { familia: string; css: string; weight: 400 | 500 | 700; style: 'normal' | 'italic'; name: string }[] = [
  { name: 'Bodoni', familia: 'Bodoni Moda', css: 'ital,wght@0,700', weight: 700, style: 'normal' },
  { name: 'Bodoni', familia: 'Bodoni Moda', css: 'ital,wght@1,500', weight: 500, style: 'italic' },
  { name: 'Manrope', familia: 'Manrope', css: 'wght@500', weight: 500, style: 'normal' },
];

const cache = new Map<string, Promise<ArrayBuffer | null>>();

async function baixar(familia: string, css: string): Promise<ArrayBuffer | null> {
  try {
    const sheet = await fetch(`https://fonts.googleapis.com/css2?family=${familia.replace(/ /g, '+')}:${css}`, {
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
    if (!sheet.ok) return null;
    const m = /src:\s*url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/.exec(await sheet.text());
    if (!m) return null;
    const arquivo = await fetch(m[1], { signal: AbortSignal.timeout(8000), next: { revalidate: 60 * 60 * 24 * 30 } });
    return arquivo.ok ? await arquivo.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/** Fontes disponíveis. Se uma falhar, a imagem sai com a fonte padrão em vez de dar erro. */
export async function carregarFontes(): Promise<Fonte[]> {
  const lista = await Promise.all(
    DEFINICOES.map(async (d) => {
      const chave = `${d.familia}|${d.css}`;
      let p = cache.get(chave);
      if (!p) {
        p = baixar(d.familia, d.css);
        cache.set(chave, p);
      }
      const data = await p;
      if (!data) cache.delete(chave); // tenta de novo na próxima
      return data ? ({ name: d.name, data, weight: d.weight, style: d.style } as Fonte) : null;
    }),
  );
  return lista.filter((f): f is Fonte => f !== null);
}
