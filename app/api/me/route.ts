import { del } from '@vercel/blob';
import { parsePostImages } from '@/app/api/posts/_utils';
import { NextResponse } from 'next/server';
import { cleanText, HttpError, isBlobUrl, ok, readJson, requireUser, route } from '@/app/lib/api';
import { query, transaction } from '@/app/lib/db';
import { verifyPassword } from '@/app/lib/password';
import { clearSessionCookie } from '@/app/lib/session';

export const PUT = route(async (req) => {
  const me = await requireUser();
  const body = await readJson(req);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Dados inválidos.');
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of ['name', 'bio', 'avatar_url'] as const) {
    if (!(key in body)) continue;
    if (typeof body[key] !== 'string') throw new HttpError(400, `Campo ${key} inválido.`);
    const value = cleanText(body[key], key === 'name' ? 'nome' : key === 'bio' ? 'bio' : 'foto', key === 'bio' ? 160 : key === 'name' ? 120 : 2048, key === 'name');
    if (key === 'avatar_url' && value && !isBlobUrl(value)) {
      throw new HttpError(400, 'Escolha uma foto enviada pelo aplicativo.');
    }
    values.push(value || null);
    fields.push(`${key} = $${values.length}`);
  }
  if (!fields.length) throw new HttpError(400, 'Informe o que deseja atualizar.');
  const user = await transaction(async (q) => {
    const { rows } = await q(`UPDATE family_users SET ${fields.join(', ')} WHERE id = $${values.length + 1}
      RETURNING id, name, username, avatar_url, bio, is_admin`, [...values, me.id]);
    if (!rows[0]) throw new HttpError(404, 'Pessoa não encontrada.');
    if ('name' in body) await q('UPDATE participants SET name = $1 WHERE user_id = $2', [rows[0].name, me.id]);
    return rows[0];
  });
  return ok({ ...user, participant_id: me.participant_id });
});

// DELETE /api/me { password } -> exclui a conta (exigência da App Store e da Play).
// Apaga login, posts, comentários, reações, enquetes, notificações e o CPF/endereço guardados.
// O participante fica anônimo e sem login (o histórico da vaquinha e do sorteio não some para os outros).
export const DELETE = route(async (req) => {
  const me = await requireUser();
  const body = await readJson<Record<string, unknown>>(req);
  const password = typeof body.password === 'string' ? body.password : '';
  const { rows } = await query('SELECT password_hash FROM family_users WHERE id = $1', [me.id]);
  if (!rows[0] || !(await verifyPassword(password, rows[0].password_hash))) {
    throw new HttpError(400, 'Senha não confere.');
  }
  if (me.is_admin) {
    const { rows: outros } = await query(
      `SELECT count(*) FILTER (WHERE is_admin AND id <> $1)::int AS admins,
              count(*) FILTER (WHERE id <> $1)::int AS pessoas
         FROM family_users`,
      [me.id],
    );
    if (outros[0].pessoas > 0 && outros[0].admins === 0) {
      throw new HttpError(409, 'Você é o único organizador. Torne outra pessoa organizadora antes de excluir sua conta.');
    }
  }
  const urls = await transaction(async (q) => {
    const { rows: users } = await q('SELECT avatar_url FROM family_users WHERE id = $1 FOR UPDATE', [me.id]);
    const { rows: posts } = await q('SELECT image_url, image_urls FROM family_posts WHERE user_id = $1', [me.id]);
    const images = posts.flatMap((post) => parsePostImages(post.image_urls, post.image_url));
    if (isBlobUrl(users[0]?.avatar_url)) images.push(users[0].avatar_url);
    const { rows: participants } = await q<{ id: number }>(
      "UPDATE participants SET name = 'Ex-participante', user_id = NULL WHERE user_id = $1 RETURNING id", [me.id],
    );
    const ids = participants.map((p) => p.id);
    await q('DELETE FROM wish_list WHERE participant_id = ANY($1::int[])', [ids]);
    await q('DELETE FROM family_attendance WHERE participant_id = ANY($1::int[])', [ids]);
    await q('DELETE FROM push_devices WHERE user_id = $1', [me.id]);
    await q('DELETE FROM family_users WHERE id = $1', [me.id]);
    return [...new Set(images)].filter(isBlobUrl);
  });
  if (urls.length) {
    try {
      await del(urls, { token: process.env.BLOB_READ_WRITE_TOKEN });
    } catch (error) {
      console.error('[conta] Falha ao apagar fotos do Blob:', error instanceof Error ? error.name : 'Erro desconhecido');
    }
  }
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
});
