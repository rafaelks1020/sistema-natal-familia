import type { Metadata, Viewport } from 'next';
import { Bodoni_Moda, Manrope } from 'next/font/google';
import './globals.css';

const bodoni = Bodoni_Moda({
  variable: '--font-bodoni',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Natal em Família',
  description: 'O Natal da nossa família: mural, amigo oculto, vaquinha, álbum e a ceia.',
  appleWebApp: { capable: true, title: 'Natal em Família', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#171b18',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // Android: a tela encolhe quando o teclado abre (campos das folhas não ficam escondidos).
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${bodoni.variable} ${manrope.variable}`} suppressHydrationWarning>
      <head>
        {/* Letra maior (opção do perfil), aplicada antes de pintar para não piscar. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{if(localStorage.getItem('nf_letra')==='grande')document.documentElement.classList.add('letra-grande')}catch(e){}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
