import { cleanText, HttpError, isBlobUrl } from '@/app/lib/api';
export function media(value: unknown, field: string, required = false): string | null {
  if (!value && !required) return null;
  if (!isBlobUrl(value)) throw new HttpError(400, `Envie ${field} pelo aplicativo ou pelo site.`);
  return value;
}
export function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Dados inválidos.');
  return value as Record<string, unknown>;
}
export function recipeInput(value: unknown) {
  const b = objectBody(value);
  return [cleanText(b.titulo, 'o nome da receita', 160), cleanText(b.de_quem, 'de quem é a receita', 100),
    cleanText(b.categoria, 'a categoria', 60), media(b.foto_url, 'a foto'),
    cleanText(b.ingredientes, 'os ingredientes', 12000), cleanText(b.modo_preparo, 'o modo de preparo', 16000),
    cleanText(b.segredo, 'o segredo', 4000, false), media(b.audio_url, 'o áudio')];
}
export function storyInput(value: unknown) {
  const b = objectBody(value);
  const duration = b.duracao_s ?? 0;
  if (typeof duration !== 'number' || !Number.isInteger(duration) || duration < 0 || duration > 86400) throw new HttpError(400, 'Duração do áudio inválida.');
  return [cleanText(b.titulo, 'o título', 160), cleanText(b.quem_conta, 'quem conta', 100),
    cleanText(b.epoca, 'a época', 100), media(b.audio_url, 'o áudio', true), media(b.foto_url, 'a foto'),
    cleanText(b.transcricao, 'a transcrição', 30000, false), duration];
}
