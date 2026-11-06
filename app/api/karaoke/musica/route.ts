import { route, ok, cleanText, HttpError, requireUser } from '@/app/lib/api';
import { dentroDoLimite } from '@/app/lib/limite';
import { buscarMusicas, type FaixaLrclib } from '../_lrclib';

export const dynamic = 'force-dynamic';

/** Busca de MÚSICA no LRCLIB para o karaokê com letra na tela. Devolve só dados leves (a letra vem na hora de entrar na fila). */
export const GET = route(async (req) => {
  const me = await requireUser();
  if (!dentroDoLimite('karaoke-musica', me.id, 12)) throw new HttpError(429, 'Muitas buscas seguidas. Espere um minutinho e tente de novo.');
  const q = cleanText(new URL(req.url).searchParams.get('q'), 'a busca', 120);
  let musicas: FaixaLrclib[];
  try {
    musicas = await buscarMusicas(q);
  } catch (err) {
    console.error('[karaoke] lrclib:', err);
    throw new HttpError(502, 'Não consegui buscar as letras agora. Tente de novo ou use a busca de vídeo de karaokê.');
  }
  return ok({ musicas });
});
