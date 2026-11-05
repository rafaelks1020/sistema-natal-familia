import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // Fotos da família ficam no Vercel Blob; o otimizador entrega no tamanho da tela (AVIF/WebP).
    remotePatterns: [{ protocol: 'https', hostname: '*.public.blob.vercel-storage.com' }],
    formats: ['image/avif', 'image/webp'],
    qualities: [72, 75, 80],
    deviceSizes: [384, 640, 828, 1080, 1280],
    imageSizes: [96, 160, 256],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default nextConfig;
