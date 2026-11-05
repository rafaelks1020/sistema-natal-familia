import { ok, requireAdmin, route } from '@/app/lib/api';
import { resumo } from '@/app/lib/admin/consulta';

export const GET = route(async () => {
  await requireAdmin();
  const r = ok(await resumo());
  r.headers.set('Cache-Control', 'no-store');
  return r;
});
