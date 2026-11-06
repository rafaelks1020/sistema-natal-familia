import { HttpError } from '@/app/lib/api';
import type { StatusCatalogo } from '@/app/telao/karaoke/tipos';

export { slugDaMusica } from '@/app/telao/karaoke/tipos';

export const MAX_EM_PREPARO = 3;
export const EM_PREPARO: StatusCatalogo[] = ['na_fila', 'baixando', 'processando'];

export interface LinhaCatalogo {
  id: number | string;
  slug: string;
  artista: string;
  faixa: string;
  status: StatusCatalogo;
  capa_url: string | null;
  duracao_ms: number | null;
  lrclib_id: number | string | null;
}

export function musicaCatalogo(l: LinhaCatalogo) {
  return {
    id: Number(l.id), slug: l.slug, artista: l.artista, faixa: l.faixa, status: l.status,
    capa_url: l.capa_url, duracao_ms: l.duracao_ms, lrclib_id: l.lrclib_id == null ? null : Number(l.lrclib_id),
  };
}

export const COLUNAS_CATALOGO = 'id, slug, artista, faixa, status, capa_url, duracao_ms, lrclib_id';

/** Tabela ou coluna do estúdio ausente: avisa para rodar a migração em vez de dar erro 500. */
export function comMigracaoEstudio<C = unknown>(h: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      return await h(req, ctx);
    } catch (err) {
      const codigo = typeof err === 'object' && err !== null ? (err as { code?: string }).code : undefined;
      if (codigo === '42P01' || codigo === '42703') throw new HttpError(503, 'Rode a migração 040');
      throw err;
    }
  };
}
