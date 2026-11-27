import { randomBytes } from 'node:crypto';
import { cleanText, HttpError, ok, readJson, requireAdmin, route } from '@/app/lib/api';
import { registrarSemFalhar } from '@/app/lib/admin/consulta';
import { query } from '@/app/lib/db';
import { CONTA_REVISAO_LOJAS } from '@/app/lib/gamificacao/motor';
import { erroBonus, rotaDoBonus } from '@/app/lib/bonus-notificacao';
import { enviarPush } from '@/app/lib/push';

export const dynamic = 'force-dynamic';

type Linha = {
  id: number;
  titulo: string | null;
  corpo: string | null;
  pontos: number;
  criado_em: Date | string;
  enviado_em: Date | string | null;
  expira_em: Date | string;
  resgates: number | string;
  expirado: boolean;
};

function inteiro(valor: unknown, rotulo: string, min: number, max: number, padrao?: number): number {
  if ((valor === undefined || valor === null || valor === '') && padrao !== undefined) return padrao;
  const n = typeof valor === 'number' ? valor : typeof valor === 'string' ? Number(valor.trim()) : NaN;
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, `${rotulo} precisa ser um número inteiro de ${min} a ${max}.`);
  return n;
}

const iso = (v: Date | string | null): string | null => (v == null ? null : new Date(v).toISOString());

// GET /api/admin/bonus-notificacao -> { bonus: [{ id, titulo, corpo, pontos, criado_em, enviado_em, expira_em, expirado, resgates }] }
// O código secreto nunca sai daqui: ele viaja só dentro do push.
export const GET = route(async () => {
  await requireAdmin();
  try {
    const { rows } = await query<Linha>(
      `SELECT b.id, b.titulo, b.corpo, b.pontos, b.criado_em, b.enviado_em, b.expira_em,
              b.expira_em <= NOW() AS expirado,
              (SELECT COUNT(*) FROM push_bonus_resgates r WHERE r.bonus_id = b.id) AS resgates
         FROM push_bonus b
        ORDER BY b.id DESC LIMIT 40`,
    );
    const res = ok({
      bonus: rows.map((r) => ({
        id: Number(r.id), titulo: r.titulo, corpo: r.corpo, pontos: Number(r.pontos),
        criado_em: iso(r.criado_em), enviado_em: iso(r.enviado_em), expira_em: iso(r.expira_em),
        expirado: Boolean(r.expirado), resgates: Number(r.resgates),
      })),
    });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err) {
    return erroBonus(err);
  }
});

// POST /api/admin/bonus-notificacao { titulo, corpo, pontos, validade_horas? } -> { ok, enviados, id }
// Cria o bônus e manda o push AGORA para todo mundo com aparelho ativo (menos a conta de revisão das lojas).
export const POST = route(async (req) => {
  const me = await requireAdmin();
  const body = await readJson<Record<string, unknown>>(req);
  const titulo = cleanText(body.titulo, 'o título', 80);
  const corpo = cleanText(body.corpo, 'a mensagem', 240);
  const pontos = inteiro(body.pontos, 'Os pontos', 1, 1000);
  const validade = inteiro(body.validade_horas, 'A validade em horas', 1, 168, 24);
  const codigo = randomBytes(18).toString('base64url');

  let id: number;
  try {
    const { rows } = await query<{ id: number }>(
      `INSERT INTO push_bonus (codigo, titulo, corpo, pontos, criado_por, expira_em)
       VALUES ($1, $2, $3, $4, $5, NOW() + make_interval(hours => $6::int))
       RETURNING id`,
      [codigo, titulo, corpo, pontos, me.id, validade],
    );
    id = Number(rows[0].id);
  } catch (err) {
    return erroBonus(err);
  }

  const { rows: destinos } = await query<{ user_id: number }>(
    `SELECT DISTINCT d.user_id FROM push_devices d
       JOIN family_users u ON u.id = d.user_id
      WHERE d.disabled_at IS NULL AND u.name <> $1`,
    [CONTA_REVISAO_LOJAS],
  );
  const ids = destinos.map((r) => r.user_id);
  // O resgate só vale depois de enviado_em: marca antes de o push sair.
  await query(`UPDATE push_bonus SET enviado_em = NOW() WHERE id = $1`, [id]);
  if (ids.length) await enviarPush(ids, { titulo, corpo, rota: rotaDoBonus(codigo) });
  await registrarSemFalhar(me, 'enviar_bonus', 'bonus_notificacao', id,
    `"${titulo}" (${pontos} pontos, ${validade}h); ${ids.length} com aparelho ativo`);
  return ok({ ok: true, enviados: ids.length, id });
});
