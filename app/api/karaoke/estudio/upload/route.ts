import { sufixo, urlDeEnvio } from '@/app/lib/arquivos';
import { route, ok, readJson, HttpError, requireAdmin } from '@/app/lib/api';

export const dynamic = 'force-dynamic';

const SLUG = /^[a-z0-9-]{3,120}$/;

/**
 * Estúdio de karaokê (servidor de processamento): devolve uma URL de envio assinada para
 * karaoke/<slug>/instrumental-<sufixo>.mp3 (nome novo a cada envio: o cache dos arquivos é imutável).
 */
export const POST = route(async (req) => {
  await requireAdmin();
  const body = await readJson<{ slug?: unknown }>(req);
  const slug = typeof body.slug === 'string' ? body.slug : '';
  if (!SLUG.test(slug)) throw new HttpError(400, 'Slug inválido.');
  return ok(urlDeEnvio(`karaoke/${slug}/instrumental-${Date.now()}-${sufixo()}.mp3`, 'audio/mpeg', 20 * 1024 * 1024, 10 * 60));
});
