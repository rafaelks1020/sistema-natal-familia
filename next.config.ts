import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // Fotos da família ficam no Vercel Blob; o otimizador entrega no tamanho da tela (AVIF/WebP).
    remotePatterns: [{ protocol: 'https', hostname: '*.public.blob.vercel-storage.com' }, { protocol: 'https', hostname: 'arquivos.natalemfamilia.com.br', pathname: '/f/**' }, { protocol: 'https', hostname: 'natal.169-58-196-17.sslip.io', pathname: '/f/**' }],
    formats: ['image/avif', 'image/webp'],
    qualities: [60, 70, 72, 75, 80, 85, 90],
    deviceSizes: [384, 640, 828, 1080, 1280],
    imageSizes: [96, 160, 256],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default nextConfig;
