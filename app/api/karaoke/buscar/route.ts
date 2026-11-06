import { route, ok, cleanText, HttpError, requireUser } from '@/app/lib/api';
import { dentroDoLimite } from '@/app/lib/limite';
import { buscarTermo, guardarCache, idDoLink, lerCache, resolverLink, type VideoKaraoke } from '../_youtube';

export const dynamic = 'force-dynamic';

/** Busca de vídeo de karaokê direto no YouTube (opção "Não achou?" do celular): por nome ou colando o link. */
export const GET = route(async (req) => {
  const me = await requireUser();
  if (!dentroDoLimite('karaoke-buscar', me.id, 10)) throw new HttpError(429, 'Muitas buscas seguidas. Espere um minutinho e tente de novo.');
  const q = cleanText(new URL(req.url).searchParams.get('q'), 'a busca', 120);
  const id = idDoLink(q);
  const termo = /karaok/i.test(q) ? q : `${q} karaokê`;
  const chaveCache = `v:${id}`;
  if (id) {
    const guardado = lerCache(chaveCache);
    if (guardado) return ok({ videos: guardado, link: true });
  }
  let videos: VideoKaraoke[];
  try {
    videos = id ? await resolverLink(id, process.env.YOUTUBE_API_KEY || undefined) : await buscarTermo(termo);
  } catch (err) {
    if (err instanceof HttpError) throw err;
    console.error('[karaoke] busca:', err);
    throw new HttpError(502, 'Não consegui buscar no YouTube agora. Tente de novo ou cole o link do vídeo.');
  }
  if (id && videos.length) guardarCache(chaveCache, videos);
  return ok({ videos, link: Boolean(id) });
});
