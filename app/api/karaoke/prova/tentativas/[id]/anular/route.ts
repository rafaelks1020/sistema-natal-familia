import { route, ok, readJson, requireAdmin, HttpError, toInt, cleanText } from '@/app/lib/api';
import { transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { comMigracao, painelProva, semCache, travar } from '../../../_dados';
export const dynamic = 'force-dynamic';

/**
 * Admin anula uma tentativa oficial com motivo (suspeita de trapaça, falha técnica). A tentativa vira 'anulada': não conta
 * na classificação nem na final, sai da lista da fila livre e do placar, e a pessoa pode tentar de novo aquela música.
 * A nota e os detalhes ficam guardados na própria tentativa, com o motivo, para conferência.
 * Exige a migração 049 (status 'anulada' e índice único parcial).
 */
export const POST = route(comMigracao(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const me = await requireAdmin();
  const id = toInt((await ctx.params).id, 'tentativa');
  const body = await readJson<Record<string, unknown>>(req);
  const motivo = cleanText(body.motivo, 'o motivo', 300);
  if (motivo.length < 3) throw new HttpError(400, 'Explique o motivo da anulação.');
  const ano = edicaoAtual();
  try {
    return semCache(ok(await transaction(async (q) => {
      await travar(q, ano);
      const { rows } = await q<{ fila_id: string; status: string }>(
        'SELECT fila_id,status FROM karaoke_prova_tentativas WHERE id = $1 AND ano = $2 FOR UPDATE', [id, ano]);
      const t = rows[0];
      if (!t) throw new HttpError(404, 'Tentativa não encontrada.');
      if (t.status === 'cantando') throw new HttpError(409, 'A tentativa ainda está em andamento. Espere terminar para anular.');
      if (t.status !== 'anulada') {
        await q(`UPDATE karaoke_prova_tentativas SET status = 'anulada',
          detalhes = detalhes || jsonb_build_object('anulacao', jsonb_build_object('motivo',$2::text,'por',$3::int,'em',NOW()::text,'status_anterior',status,'nota_anterior',nota))
          WHERE id = $1`, [id, motivo, me.id]);
        // Sai da fila livre, do ranking e do placar, que leem karaoke_notas e a fila.
        await q('DELETE FROM karaoke_notas WHERE fila_id = $1', [t.fila_id]);
        await q(`UPDATE karaoke_fila SET status = 'pulada',parcial = NULL WHERE id = $1`, [t.fila_id]);
      }
      return painelProva(q, me);
    })));
  } catch (erro) {
    if (typeof erro === 'object' && erro && 'code' in erro && erro.code === '23514') throw new HttpError(503, 'Anular tentativas aguarda a migração 049. Avise quem organiza.');
    throw erro;
  }
}));
