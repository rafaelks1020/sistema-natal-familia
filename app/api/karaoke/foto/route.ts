import { put } from '@vercel/blob';
import { HttpError, ok, requireAdmin, route, toInt } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { hojeSP } from '@/app/lib/edicao';

// POST /api/karaoke/foto (multipart: fila_id, foto JPEG até 4 MB, nota opcional) -> { url }.
// Só admin (o telão). Sobe para o Vercel Blob e publica no álbum da família (album_photos), autor = admin.

export const dynamic = 'force-dynamic';

const MAX_BYTES = 4 * 1024 * 1024;

interface LinhaFoto {
  ano: number;
  titulo: string;
  faixa: string | null;
  nome: string;
  dueto_nome: string | null;
  nota: number | null;
}

export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new HttpError(503, 'Envio de fotos ainda não configurado.');

  const form = await req.formData().catch(() => null);
  const filaId = toInt(form?.get('fila_id'), 'fila_id');
  const foto = form?.get('foto');
  if (!(foto instanceof File)) throw new HttpError(400, 'Nenhuma foto enviada.');
  if (foto.type !== 'image/jpeg') throw new HttpError(400, 'A foto precisa ser JPEG.');
  if (foto.size === 0 || foto.size > MAX_BYTES) throw new HttpError(400, 'A foto precisa ter até 4 MB.');
  const cabecalho = new Uint8Array(await foto.slice(0, 3).arrayBuffer());
  if (cabecalho[0] !== 0xff || cabecalho[1] !== 0xd8 || cabecalho[2] !== 0xff) throw new HttpError(400, 'Arquivo de foto inválido.');

  const { rows } = await query<LinhaFoto>(
    `SELECT f.ano, f.titulo, f.faixa, u.name AS nome, d.name AS dueto_nome, n.nota
       FROM karaoke_fila f
       JOIN family_users u ON u.id = f.user_id
       LEFT JOIN family_users d ON d.id = f.dueto_user_id
       LEFT JOIN karaoke_notas n ON n.fila_id = f.id
      WHERE f.id = $1`,
    [filaId],
  );
  const fila = rows[0];
  if (!fila) throw new HttpError(404, 'Música não encontrada na fila.');

  // A nota pode ainda não ter sido gravada (foto no pico do placar): aceita a que o telão mandou.
  const notaForm = Number(form?.get('nota'));
  const nota = fila.nota ?? (Number.isInteger(notaForm) && notaForm >= 0 && notaForm <= 100 ? notaForm : null);
  const quem = fila.dueto_nome ? `${fila.nome} e ${fila.dueto_nome}` : fila.nome;
  const musica = (fila.faixa || fila.titulo).slice(0, 200);
  const legenda = `${quem} cantando ${musica} no karaokê${nota !== null ? `, nota ${nota}` : ''}`.slice(0, 500);

  const blob = await put(`karaoke/fotos/${fila.ano}/${filaId}-${Date.now()}.jpg`, foto, {
    access: 'public',
    token,
    addRandomSuffix: true,
    contentType: 'image/jpeg',
  });

  // A data da foto precisa cair no ano da edição (CHECK da tabela); em janeiro/fevereiro usa 25/12 da edição.
  const hoje = hojeSP();
  const tiradaEm = Number(hoje.slice(0, 4)) === fila.ano ? hoje : `${fila.ano}-12-25`;
  await query(
    `INSERT INTO album_photos(ano, user_id, image_url, caption, taken_on, client_key) VALUES($1,$2,$3,$4,$5,$6)`,
    [fila.ano, admin.id, blob.url, legenda, tiradaEm, `karaoke-${filaId}-${Date.now()}`],
  );
  return ok({ url: blob.url }, 201);
});
