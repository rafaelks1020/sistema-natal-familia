import { ok, readJson, requireAdmin, route } from '@/app/lib/api';
import { salvarLink } from '../_service';

export const PUT = route(async req => {
  await requireAdmin();
  const body = await readJson<Record<string, unknown>>(req);
  return ok(await salvarLink(body?.link));
});
