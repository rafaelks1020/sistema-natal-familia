import { ok, requireUser, route } from '@/app/lib/api';
import { SECOES, type Secao } from '@/app/telao/tipos';
import { getEstado } from './_data';

export const dynamic = 'force-dynamic';

/** Estado do telão. Parte leve sempre; listas pesadas só se pedidas: ?inclui=fotos,recados,advento,placar,presentes,ceia,linha,nomes */
export const GET = route(async (req) => {
  const me = await requireUser();
  const pedido = new URL(req.url).searchParams.get('inclui') ?? '';
  const inclui = new Set(pedido.split(',').filter((s): s is Secao => (SECOES as readonly string[]).includes(s)));
  return ok(await getEstado(me, inclui));
});
