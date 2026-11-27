import { HttpError, ok, readJson, requireUser, route } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { CODIGO_BONUS_REGEX, erroBonus, TITULO_PADRAO_BONUS } from '@/app/lib/bonus-notificacao';
import { CONTA_REVISAO_LOJAS, invalidarCachesGamificacao } from '@/app/lib/gamificacao/motor';

export const dynamic = 'force-dynamic';

type Bonus = { id: number; titulo: string | null; pontos: number; enviado: boolean; expirado: boolean };

// POST /api/bonus/resgatar { codigo } -> { ok, ganhou, ja_resgatado, pontos, titulo }
// Uma vez por pessoa e só dentro da validade. O código só chega pelo push (rota /bonus/<codigo>).
export const POST = route(async (req) => {
  const me = await requireUser();
  const body = await readJson<Record<string, unknown>>(req);
  const codigo = typeof body.codigo === 'string' ? body.codigo.trim() : '';
  if (!CODIGO_BONUS_REGEX.test(codigo)) throw new HttpError(404, 'Bônus não encontrado');

  try {
    const { rows } = await query<Bonus>(
      `SELECT id, titulo, pontos, enviado_em IS NOT NULL AS enviado, expira_em <= NOW() AS expirado
         FROM push_bonus WHERE codigo = $1`,
      [codigo],
    );
    const bonus = rows[0];
    if (!bonus || !bonus.enviado) throw new HttpError(404, 'Bônus não encontrado');
    const resposta = (ganhou: boolean, jaResgatado: boolean) => {
      const res = ok({
        ok: true, ganhou, ja_resgatado: jaResgatado, pontos: Number(bonus.pontos), titulo: bonus.titulo || TITULO_PADRAO_BONUS,
      });
      res.headers.set('Cache-Control', 'private, no-store');
      return res;
    };
    // Conta de revisão das lojas vê a tela normal, mas não pontua (o motor também a ignora).
    if (me.name === CONTA_REVISAO_LOJAS) return resposta(true, false);

    const jaTem = async () => (await query(
      `SELECT 1 FROM push_bonus_resgates WHERE bonus_id = $1 AND user_id = $2`, [bonus.id, me.id],
    )).rows.length > 0;

    if (await jaTem()) return resposta(false, true);
    if (bonus.expirado) throw new HttpError(410, 'Esse bônus já expirou');

    // A validade é conferida no próprio INSERT: dois toques ou a virada do prazo não passam duas vezes.
    const { rows: novo } = await query(
      `INSERT INTO push_bonus_resgates (bonus_id, user_id)
       SELECT id, $2::int FROM push_bonus WHERE id = $1 AND enviado_em IS NOT NULL AND expira_em > NOW()
       ON CONFLICT DO NOTHING RETURNING bonus_id`,
      [bonus.id, me.id],
    );
    if (novo.length) {
      invalidarCachesGamificacao();
      return resposta(true, false);
    }
    if (await jaTem()) return resposta(false, true);
    throw new HttpError(410, 'Esse bônus já expirou');
  } catch (err) {
    return erroBonus(err);
  }
});
