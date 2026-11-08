import type { MetadataRoute } from 'next';

// display standalone é o que o iPhone exige para o Web Push (abrir pela Tela de Início).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Natal em Família',
    short_name: 'Natal',
    description: 'O Natal da nossa família: mural, amigo oculto, vaquinha, álbum e a ceia.',
    start_url: '/',
    scope: '/',
    id: '/',
    display: 'standalone',
    background_color: '#171b18',
    theme_color: '#171b18',
    lang: 'pt-BR',
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
  };
}
