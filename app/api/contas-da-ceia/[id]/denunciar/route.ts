import { cleanText, HttpError, ok, readJson, requireUser, route, toInt } from '@/app/lib/api';
import { query, transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { enviarPush } from '@/app/lib/push';

// O registro compartilhado de denúncias não inclui despesas. Guarda o retrato para análise.
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, ctx) => {
  const me = await requireUser();
  const id = toInt((await ctx.params).id);
  const body = await readJson<Record<string, unknown> | null>(req);
  const motivo = cleanText(body?.motivo, 'o motivo', 1000);
  await transaction(async q => {
    const { rows: [despesa] } = await q<{ user_id: number; descricao: string }>('SELECT user_id, descricao FROM ceia_despesas WHERE id = $1 AND ano = $2 FOR KEY SHARE', [id, edicaoAtual()]);
    if (!despesa) throw new HttpError(404, 'Despesa não encontrada.');
    await q(`INSERT INTO content_reports (reporter_id, alvo_tipo, alvo_id, autor_id, trecho, motivo)
      VALUES ($1,'ceia_despesa',$2,$3,$4,$5)`, [me.id, id, despesa.user_id, despesa.descricao, motivo]);
  });
  const { rows: admins } = await query<{ id: number }>('SELECT id FROM family_users WHERE is_admin');
  void enviarPush(admins.map(a => a.id), { titulo: 'Despesa denunciada', corpo: 'Há uma despesa da ceia para analisar.', rota: '/contas-da-ceia' });
  return ok({ ok: true }, 201);
});
