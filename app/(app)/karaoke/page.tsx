import { Suspense } from 'react';
import KaraokeClient from './_client';

export const dynamic = 'force-dynamic';

export default function KaraokePage() {
  return (
    <Suspense fallback={<p className="px-5 pt-8 text-sm text-marfim-2">Abrindo o karaokê...</p>}>
      <KaraokeClient />
    </Suspense>
  );
}
