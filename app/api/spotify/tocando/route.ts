import { ok, requireUser, route } from '@/app/lib/api';
import { tocando } from '../_service';

/** O que está tocando agora na conta do organizador. { precisa_reconectar: true } se faltar o escopo do Spotify. */
export const GET = route(async () => {
  await requireUser();
  return ok(await tocando());
});
