import { enviarArquivo, sufixo } from '@/app/lib/arquivos';
import { HttpError, ok, requireAdmin, route, toInt } from '@/app/lib/api';
import { lerFilaParaAlbum, publicarNoAlbum } from '../_album';

// POST /api/karaoke/foto (multipart: fila_id, foto JPEG até 4 MB, nota opcional) -> { url }.
// Só admin (o telão). Sobe para o armazenamento (Storage Box) e publica no álbum da família (album_photos), autor = admin.

export const dynamic = 'force-dynamic';

const MAX_BYTES = 4 * 1024 * 1024;

export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const form = await req.formData().catch(() => null);
  const filaId = toInt(form?.get('fila_id'), 'fila_id');
  const foto = form?.get('foto');
  if (!(foto instanceof File)) throw new HttpError(400, 'Nenhuma foto enviada.');
  if (foto.type !== 'image/jpeg') throw new HttpError(400, 'A foto precisa ser JPEG.');
  if (foto.size === 0 || foto.size > MAX_BYTES) throw new HttpError(400, 'A foto precisa ter até 4 MB.');
  const cabecalho = new Uint8Array(await foto.slice(0, 3).arrayBuffer());
  if (cabecalho[0] !== 0xff || cabecalho[1] !== 0xd8 || cabecalho[2] !== 0xff) throw new HttpError(400, 'Arquivo de foto inválido.');

  const fila = await lerFilaParaAlbum(filaId);
  if (!fila) throw new HttpError(404, 'Música não encontrada na fila.');

  // A nota pode ainda não ter sido gravada (foto no pico do placar): aceita a que o telão mandou.
  const notaForm = Number(form?.get('nota'));
  const nota = fila.nota ?? (Number.isInteger(notaForm) && notaForm >= 0 && notaForm <= 100 ? notaForm : null);

  const url = await enviarArquivo(`karaoke/fotos/${fila.ano}/${filaId}-${Date.now()}-${sufixo()}.jpg`, foto, 'image/jpeg');

  await publicarNoAlbum(fila, admin.id, filaId, url, nota);
  return ok({ url }, 201);
});
