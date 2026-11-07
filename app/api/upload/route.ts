import { enviarArquivo, sufixo } from '@/app/lib/arquivos';
import { HttpError, ok, requireUser, route } from '@/app/lib/api';

// POST /api/upload (multipart, campo "file") -> { url }. Só logado, só imagem, até 8 MB.

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/gif': 'gif',
};

export const POST = route(async (req) => {
  const user = await requireUser();
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) throw new HttpError(400, 'Nenhuma foto enviada.');
  const ext = TYPES[file.type];
  if (!ext) throw new HttpError(400, 'Envie uma foto (JPG, PNG, WEBP ou HEIC).');
  if (file.size > MAX_BYTES) throw new HttpError(400, 'A foto passou de 8 MB.');

  const url = await enviarArquivo(`natal/${user.id}/${Date.now()}-${sufixo()}.${ext}`, file, file.type);
  return ok({ url });
});
