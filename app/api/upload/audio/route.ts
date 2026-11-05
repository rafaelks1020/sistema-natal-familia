import { put } from '@vercel/blob';
import { HttpError, ok, requireUser, route } from '@/app/lib/api';

const TYPES: Record<string, string> = {
  'audio/mp4': 'm4a', 'audio/m4a': 'm4a', 'audio/x-m4a': 'm4a',
  'audio/aac': 'aac', 'audio/mpeg': 'mp3', 'audio/webm': 'webm', 'audio/ogg': 'ogg',
};
export const POST = route(async (req) => {
  const me = await requireUser();
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new HttpError(503, 'Envio de áudio ainda não configurado.');
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || !file.size) throw new HttpError(400, 'Escolha um áudio ou faça uma gravação.');
  const mime = file.type.split(';')[0].toLowerCase();
  const ext = TYPES[mime];
  if (!ext) throw new HttpError(400, 'Envie um áudio M4A, AAC, MP3, WEBM ou OGG.');
  // A Vercel aceita no máximo 4,5 MB por envio: a voz gravada a 32 kbps cabe em uns 15 minutos.
  if (file.size > 4.3 * 1024 * 1024) throw new HttpError(400, 'O áudio ficou grande demais (até uns 15 minutos). Grave em duas partes.');
  const blob = await put(`natal/${me.id}/audio-${Date.now()}.${ext}`, file, {
    access: 'public', token, addRandomSuffix: true, contentType: mime,
  });
  return ok({ url: blob.url });
});
